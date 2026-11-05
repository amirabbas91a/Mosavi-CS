import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  username: text('username').notNull().unique(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').default(''),
  avatarUrl: text('avatar_url').default(''),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  rankTier: text('rank_tier').notNull().default('Rookie'),
  credits: integer('credits').notNull().default(5000),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  kills: integer('kills').notNull().default(0),
  deaths: integer('deaths').notNull().default(0),
  headshots: integer('headshots').notNull().default(0),
  role: text('role').notNull().default('player'), // 'player' | 'admin'
  isBanned: boolean('is_banned').notNull().default(false),
  equippedSkinsJson: text('equipped_skins_json').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  roomCode: text('room_code').notNull(),
  mapId: text('map_id').notNull(),
  gameMode: text('game_mode').notNull(),
  winnerTeam: text('winner_team').notNull(),
  vanguardScore: integer('vanguard_score').notNull().default(0),
  phantomScore: integer('phantom_score').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  playerUid: text('player_uid').notNull(),
  playerKills: integer('player_kills').notNull().default(0),
  playerDeaths: integer('player_deaths').notNull().default(0),
  xpEarned: integer('xp_earned').notNull().default(0),
  creditsEarned: integer('credits_earned').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userInventory = pgTable('user_inventory', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  itemId: text('item_id').notNull(),
  itemName: text('item_name').notNull(),
  category: text('category').notNull(), // 'weapon_skin' | 'knife' | 'gloves' | 'agent' | 'card' | 'effect'
  weaponId: text('weapon_id').notNull().default(''),
  equipped: boolean('equipped').notNull().default(false),
  acquiredAt: timestamp('acquired_at').defaultNow(),
});

export const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  severity: text('severity').notNull().default('info'),
  authorName: text('author_name').notNull().default('MOSAVI HQ'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const securityLogs = pgTable('security_logs', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(),
  actorUid: text('actor_uid').notNull().default('system'),
  details: text('details').notNull(),
  severity: text('severity').notNull().default('low'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const abuseReports = pgTable('abuse_reports', {
  id: serial('id').primaryKey(),
  reporterUid: text('reporter_uid').notNull(),
  suspectName: text('suspect_name').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('open'), // 'open' | 'resolved' | 'dismissed'
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  matches: many(matches),
  inventory: many(userInventory),
}));
