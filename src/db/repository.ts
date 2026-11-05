import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  abuseReports,
  announcements,
  matches,
  securityLogs,
  userInventory,
  users,
} from './schema.ts';
import {
  calculateLevelFromXp,
  calculateRankFromXp,
  computeMatchRewards,
  validateStorePurchase,
} from '../game/rules.ts';
import { STORE_CATALOG } from '../game/weapons.ts';

export function hashPasswordSecure(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasswordSecure(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

export function sanitizeUser(u: typeof users.$inferSelect) {
  const { passwordHash: _ignored, ...rest } = u;
  return rest;
}

export async function getOrCreateFirebaseUser(uid: string, email: string, preferredUsername?: string) {
  try {
    const cleanUsername =
      (preferredUsername || email.split('@')[0] || 'OPERATOR')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 18)
        .toUpperCase() +
      '_' +
      uid.slice(0, 4).toUpperCase();

    const result = await db
      .insert(users)
      .values({
        uid,
        username: cleanUsername,
        email,
        role: email === 'anarakiamirabbas@gmail.com' ? 'admin' : 'player',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email },
      })
      .returning();

    return sanitizeUser(result[0]);
  } catch (error) {
    console.error('Database error in getOrCreateFirebaseUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function registerCustomUser(input: {
  username: string;
  email: string;
  password: string;
}) {
  try {
    const normalizedUsername = input.username.trim();
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingByUsername = await db
      .select()
      .from(users)
      .where(eq(users.username, normalizedUsername));

    if (existingByUsername.length > 0) {
      throw new Error('USERNAME_TAKEN');
    }

    const uid = `op-${crypto.randomUUID().slice(0, 12)}`;
    const passwordHash = hashPasswordSecure(input.password);

    const inserted = await db
      .insert(users)
      .values({
        uid,
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        credits: 5500,
        role: normalizedEmail === 'anarakiamirabbas@gmail.com' ? 'admin' : 'player',
      })
      .returning();

    await logSecurityEvent(
      'USER_REGISTERED',
      uid,
      `Operator ${normalizedUsername} registered with encrypted scrypt credentials`,
      'low'
    );

    return sanitizeUser(inserted[0]);
  } catch (error: any) {
    if (error?.message === 'USERNAME_TAKEN') throw error;
    console.error('Database error in registerCustomUser:', error);
    throw new Error('Registration failed. Please check username uniqueness.', { cause: error });
  }
}

export async function loginCustomUser(identifier: string, password: string) {
  try {
    const clean = identifier.trim();
    const allUsers = await db.select().from(users);
    const found = allUsers.find(
      (u) =>
        u.username.toLowerCase() === clean.toLowerCase() ||
        u.email.toLowerCase() === clean.toLowerCase()
    );

    if (!found || !found.passwordHash) {
      throw new Error('INVALID_CREDENTIALS');
    }
    if (found.isBanned) {
      throw new Error('ACCOUNT_BANNED');
    }

    const valid = verifyPasswordSecure(password, found.passwordHash);
    if (!valid) {
      await logSecurityEvent(
        'FAILED_LOGIN',
        found.uid,
        `Failed password verification for ${found.username}`,
        'medium'
      );
      throw new Error('INVALID_CREDENTIALS');
    }

    return sanitizeUser(found);
  } catch (error: any) {
    if (error?.message === 'INVALID_CREDENTIALS' || error?.message === 'ACCOUNT_BANNED') {
      throw error;
    }
    console.error('Database error in loginCustomUser:', error);
    throw new Error('Authentication failed.', { cause: error });
  }
}

export async function getUserProfileByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid));
    if (!rows.length) return null;
    const inv = await db
      .select()
      .from(userInventory)
      .where(eq(userInventory.userUid, uid));
    const recentMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.playerUid, uid))
      .orderBy(desc(matches.createdAt))
      .limit(15);

    return {
      user: sanitizeUser(rows[0]),
      inventory: inv,
      recentMatches,
    };
  } catch (error) {
    console.error('Database error in getUserProfileByUid:', error);
    throw new Error('Failed to load operator profile.', { cause: error });
  }
}

export async function getGlobalLeaderboard() {
  try {
    const rows = await db
      .select()
      .from(users)
      .orderBy(desc(users.xp), desc(users.kills))
      .limit(50);
    return rows.map(sanitizeUser);
  } catch (error) {
    console.error('Database error in getGlobalLeaderboard:', error);
    throw new Error('Failed to fetch global leaderboard.', { cause: error });
  }
}

export async function recordMatchResultForUser(input: {
  uid: string;
  roomCode: string;
  mapId: string;
  gameMode: string;
  winnerTeam: string;
  vanguardScore: number;
  phantomScore: number;
  durationSeconds: number;
  kills: number;
  deaths: number;
  headshots: number;
  wonMatch: boolean;
  bombObjectives: number;
}) {
  try {
    // Server-side anti-cheat sanity clamp on reported match stats
    const safeKills = Math.max(0, Math.min(80, Math.floor(input.kills)));
    const safeDeaths = Math.max(0, Math.min(80, Math.floor(input.deaths)));
    const safeHeadshots = Math.max(0, Math.min(safeKills, Math.floor(input.headshots)));

    const rewards = computeMatchRewards({
      kills: safeKills,
      deaths: safeDeaths,
      headshots: safeHeadshots,
      wonMatch: input.wonMatch,
      bombObjectives: Math.max(0, Math.min(10, input.bombObjectives)),
    });

    await db.insert(matches).values({
      roomCode: input.roomCode || 'LOCAL',
      mapId: input.mapId,
      gameMode: input.gameMode,
      winnerTeam: input.winnerTeam,
      vanguardScore: input.vanguardScore,
      phantomScore: input.phantomScore,
      durationSeconds: input.durationSeconds,
      playerUid: input.uid,
      playerKills: safeKills,
      playerDeaths: safeDeaths,
      xpEarned: rewards.xpEarned,
      creditsEarned: rewards.creditsEarned,
    });

    const userRows = await db.select().from(users).where(eq(users.uid, input.uid));
    if (userRows.length > 0) {
      const u = userRows[0];
      const nextXp = u.xp + rewards.xpEarned;
      const nextLevel = calculateLevelFromXp(nextXp);
      const nextRank = calculateRankFromXp(nextXp);
      const nextCredits = u.credits + rewards.creditsEarned;

      const updated = await db
        .update(users)
        .set({
          xp: nextXp,
          level: nextLevel,
          rankTier: nextRank,
          credits: nextCredits,
          wins: u.wins + (input.wonMatch ? 1 : 0),
          losses: u.losses + (input.wonMatch ? 0 : 1),
          kills: u.kills + safeKills,
          deaths: u.deaths + safeDeaths,
          headshots: u.headshots + safeHeadshots,
        })
        .where(eq(users.uid, input.uid))
        .returning();

      return {
        user: sanitizeUser(updated[0]),
        xpEarned: rewards.xpEarned,
        creditsEarned: rewards.creditsEarned,
      };
    }

    return {
      user: null,
      xpEarned: rewards.xpEarned,
      creditsEarned: rewards.creditsEarned,
    };
  } catch (error) {
    console.error('Database error in recordMatchResultForUser:', error);
    throw new Error('Failed to record match result.', { cause: error });
  }
}

export async function purchaseStoreItemForUser(uid: string, itemId: string) {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    if (!userRows.length) throw new Error('USER_NOT_FOUND');
    const user = userRows[0];

    const inv = await db
      .select()
      .from(userInventory)
      .where(eq(userInventory.userUid, uid));

    const ownedIds = inv.map((i) => i.itemId);
    const check = validateStorePurchase(user.credits, ownedIds, itemId);
    if (!check.valid) {
      throw new Error(check.reason || 'PURCHASE_REJECTED');
    }

    const catalogItem = STORE_CATALOG.find((c) => c.id === itemId)!;

    await db.insert(userInventory).values({
      userUid: uid,
      itemId: catalogItem.id,
      itemName: catalogItem.name,
      category: catalogItem.category,
      weaponId: catalogItem.weaponId || '',
      equipped: true,
    });

    // Update equipped skins map on user record
    let equippedMap: Record<string, string> = {};
    try {
      equippedMap = JSON.parse(user.equippedSkinsJson || '{}');
    } catch {
      equippedMap = {};
    }
    const slotKey = catalogItem.weaponId || catalogItem.category;
    equippedMap[slotKey] = catalogItem.id;

    const updated = await db
      .update(users)
      .set({
        credits: check.remainingCredits,
        equippedSkinsJson: JSON.stringify(equippedMap),
      })
      .where(eq(users.uid, uid))
      .returning();

    const updatedInv = await db
      .select()
      .from(userInventory)
      .where(eq(userInventory.userUid, uid));

    return {
      user: sanitizeUser(updated[0]),
      inventory: updatedInv,
    };
  } catch (error: any) {
    if (
      error?.message === 'ALREADY_OWNED' ||
      error?.message === 'INSUFFICIENT_CREDITS' ||
      error?.message === 'ITEM_NOT_FOUND'
    ) {
      throw error;
    }
    console.error('Database error in purchaseStoreItemForUser:', error);
    throw new Error('Store transaction failed.', { cause: error });
  }
}

export async function equipInventoryItemForUser(uid: string, itemId: string) {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    if (!userRows.length) throw new Error('USER_NOT_FOUND');
    const user = userRows[0];

    const catalogItem = STORE_CATALOG.find((c) => c.id === itemId);
    if (!catalogItem) throw new Error('ITEM_NOT_FOUND');

    let equippedMap: Record<string, string> = {};
    try {
      equippedMap = JSON.parse(user.equippedSkinsJson || '{}');
    } catch {
      equippedMap = {};
    }
    const slotKey = catalogItem.weaponId || catalogItem.category;
    equippedMap[slotKey] = catalogItem.id;

    const updated = await db
      .update(users)
      .set({ equippedSkinsJson: JSON.stringify(equippedMap) })
      .where(eq(users.uid, uid))
      .returning();

    return sanitizeUser(updated[0]);
  } catch (error) {
    console.error('Database error in equipInventoryItemForUser:', error);
    throw new Error('Failed to equip item.', { cause: error });
  }
}

export async function getAdminOverviewData() {
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);
    const recentMatches = await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(30);
    const allAnnouncements = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt))
      .limit(20);
    const reports = await db
      .select()
      .from(abuseReports)
      .orderBy(desc(abuseReports.createdAt))
      .limit(30);
    const logs = await db
      .select()
      .from(securityLogs)
      .orderBy(desc(securityLogs.createdAt))
      .limit(40);

    return {
      users: allUsers.map(sanitizeUser),
      matches: recentMatches,
      announcements: allAnnouncements,
      abuseReports: reports,
      securityLogs: logs,
    };
  } catch (error) {
    console.error('Database error in getAdminOverviewData:', error);
    throw new Error('Failed to load admin overview.', { cause: error });
  }
}

export async function toggleUserBanStatus(targetUid: string, isBanned: boolean, adminUid: string) {
  try {
    const updated = await db
      .update(users)
      .set({ isBanned })
      .where(eq(users.uid, targetUid))
      .returning();

    await logSecurityEvent(
      isBanned ? 'USER_BANNED' : 'USER_UNBANNED',
      adminUid,
      `Target UID ${targetUid} ban status set to ${isBanned}`,
      'high'
    );

    return updated[0] ? sanitizeUser(updated[0]) : null;
  } catch (error) {
    console.error('Database error in toggleUserBanStatus:', error);
    throw new Error('Failed to update user ban status.', { cause: error });
  }
}

export async function createAnnouncementRecord(
  title: string,
  content: string,
  severity: string,
  authorName: string
) {
  try {
    const inserted = await db
      .insert(announcements)
      .values({ title, content, severity, authorName })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database error in createAnnouncementRecord:', error);
    throw new Error('Failed to publish announcement.', { cause: error });
  }
}

export async function updateAbuseReportStatus(id: number, status: string) {
  try {
    const updated = await db
      .update(abuseReports)
      .set({ status })
      .where(eq(abuseReports.id, id))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database error in updateAbuseReportStatus:', error);
    throw new Error('Failed to update abuse report.', { cause: error });
  }
}

export async function createAbuseReportRecord(
  reporterUid: string,
  suspectName: string,
  reason: string
) {
  try {
    const inserted = await db
      .insert(abuseReports)
      .values({ reporterUid, suspectName, reason, status: 'open' })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database error in createAbuseReportRecord:', error);
    throw new Error('Failed to submit abuse report.', { cause: error });
  }
}

export async function logSecurityEvent(
  eventType: string,
  actorUid: string,
  details: string,
  severity: 'low' | 'medium' | 'high' = 'low'
) {
  try {
    await db.insert(securityLogs).values({
      eventType,
      actorUid,
      details,
      severity,
    });
  } catch (error) {
    console.error('Failed to write security log:', error);
  }
}
