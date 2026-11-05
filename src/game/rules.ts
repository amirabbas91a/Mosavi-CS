import { WEAPONS, WeaponId, STORE_CATALOG } from './weapons.ts';

export type RankTier =
  | 'Rookie'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Elite'
  | 'MOSAVI Legend';

export type GameModeId =
  | 'tdm'
  | 'dm'
  | 'bomb'
  | 'practice'
  | 'bots'
  | 'multiplayer';

export type BotDifficulty = 'Easy' | 'Normal' | 'Hard' | 'Expert';

export interface GameModeConfig {
  id: GameModeId;
  nameEn: string;
  nameFa: string;
  descEn: string;
  descFa: string;
  matchDurationSec: number;
  targetScore: number;
  respawnDelaySec: number;
  allowRespawn: boolean;
  hasBombObjective: boolean;
  startingCash: number;
}

export const GAME_MODES: Record<GameModeId, GameModeConfig> = {
  tdm: {
    id: 'tdm',
    nameEn: 'Team Deathmatch',
    nameFa: 'نبرد تیمی (Team Deathmatch)',
    descEn: 'Two tactical squads battle for supremacy. Instant respawn, first team to 40 kills wins.',
    descFa: 'مبارزه دو تیم ونگارد و فانتوم با Respawn سریع؛ اولین تیمی که به ۴۰ امتیاز برسد پیروز است.',
    matchDurationSec: 480,
    targetScore: 40,
    respawnDelaySec: 3,
    allowRespawn: true,
    hasBombObjective: false,
    startingCash: 4500,
  },
  dm: {
    id: 'dm',
    nameEn: 'Deathmatch',
    nameFa: 'مبارزه آزاد (Deathmatch)',
    descEn: 'High-intensity tactical combat with fast respawns and full weapon access.',
    descFa: 'نبرد سریع و پرهیجان برای کسب بالاترین تعداد Kill در زمان مسابقه.',
    matchDurationSec: 360,
    targetScore: 30,
    respawnDelaySec: 2,
    allowRespawn: true,
    hasBombObjective: false,
    startingCash: 10000,
  },
  bomb: {
    id: 'bomb',
    nameEn: 'Bomb Defusal',
    nameFa: 'خنثی‌سازی بمب (Bomb Defusal)',
    descEn: 'Tactical objective mode. Phantom plants C4 at Site A or B; Vanguard defends and defuses.',
    descFa: 'حالت رقابتی کلاسیک؛ تیم مهاجم بمب C4 را در سایت A یا B کار می‌گذارد و تیم مدافع آن را خنثی می‌کند.',
    matchDurationSec: 135,
    targetScore: 8,
    respawnDelaySec: 5,
    allowRespawn: true,
    hasBombObjective: true,
    startingCash: 3200,
  },
  practice: {
    id: 'practice',
    nameEn: 'Practice Range',
    nameFa: 'میدان تمرین (Practice)',
    descEn: 'Test all 12 weapons, recoil patterns, grenades, and tactical movement with maximum funds.',
    descFa: 'تمرین آزاد با دسترسی کامل به تمام ۱۲ سلاح، نارنجک‌ها و بررسی لگد اسلحه‌ها.',
    matchDurationSec: 900,
    targetScore: 100,
    respawnDelaySec: 1.5,
    allowRespawn: true,
    hasBombObjective: false,
    startingCash: 16000,
  },
  bots: {
    id: 'bots',
    nameEn: 'Offline vs Smart Bots',
    nameFa: 'مسابقه با بات‌های هوشمند',
    descEn: 'Battle against pathfinding AI operators across 4 difficulty tiers (Easy to Expert).',
    descFa: 'رقابت تاکتیکی آفلاین با بات‌های مجهز به مسیریابی هوشمند، پناه‌گیری و پرتاب نارنجک.',
    matchDurationSec: 420,
    targetScore: 35,
    respawnDelaySec: 3,
    allowRespawn: true,
    hasBombObjective: true,
    startingCash: 4000,
  },
  multiplayer: {
    id: 'multiplayer',
    nameEn: 'Online Multiplayer',
    nameFa: 'رقابت آنلاین چندنفره',
    descEn: 'Real-time WebSocket synchronized tactical combat with server-side validation.',
    descFa: 'اتصال هم‌زمان بازیکنان از طریق سرور WebSocket با اعتبارسنجی ضدتقلب سمت سرور.',
    matchDurationSec: 480,
    targetScore: 40,
    respawnDelaySec: 3,
    allowRespawn: true,
    hasBombObjective: true,
    startingCash: 4000,
  },
};

export const RANK_THRESHOLDS: { tier: RankTier; minXp: number; nameFa: string; colorHex: string }[] = [
  { tier: 'Rookie', minXp: 0, nameFa: 'تازه‌کار (Rookie)', colorHex: '#9ca3af' },
  { tier: 'Bronze', minXp: 1000, nameFa: 'برنز (Bronze)', colorHex: '#d97706' },
  { tier: 'Silver', minXp: 2800, nameFa: 'نقره (Silver)', colorHex: '#cbd5e1' },
  { tier: 'Gold', minXp: 5500, nameFa: 'طلا (Gold)', colorHex: '#facc15' },
  { tier: 'Platinum', minXp: 9000, nameFa: 'پلاتینیوم (Platinum)', colorHex: '#38bdf8' },
  { tier: 'Diamond', minXp: 13500, nameFa: 'الماس (Diamond)', colorHex: '#818cf8' },
  { tier: 'Elite', minXp: 18500, nameFa: 'نخبه (Elite)', colorHex: '#f43f5e' },
  { tier: 'MOSAVI Legend', minXp: 25000, nameFa: 'افسانه MOSAVI', colorHex: '#ef4444' },
];

export function calculateRankFromXp(xp: number): RankTier {
  const safeXp = Math.max(0, Math.floor(xp));
  let current: RankTier = 'Rookie';
  for (const item of RANK_THRESHOLDS) {
    if (safeXp >= item.minXp) {
      current = item.tier;
    }
  }
  return current;
}

export function calculateLevelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  return Math.min(100, Math.floor(safeXp / 550) + 1);
}

export function calculateKDRatio(kills: number, deaths: number): number {
  if (deaths <= 0) return Number(Math.max(0, kills).toFixed(2));
  return Number((Math.max(0, kills) / deaths).toFixed(2));
}

export interface DamageCalculationInput {
  weaponId: WeaponId;
  distanceMeters: number;
  isHeadshot: boolean;
  targetHealth: number;
  targetArmor: number;
}

export interface DamageCalculationResult {
  healthDamage: number;
  armorDamage: number;
  nextHealth: number;
  nextArmor: number;
  isLethal: boolean;
}

export function computeWeaponDamage(input: DamageCalculationInput): DamageCalculationResult {
  const weapon = WEAPONS[input.weaponId];
  if (!weapon || input.distanceMeters > weapon.range) {
    return {
      healthDamage: 0,
      armorDamage: 0,
      nextHealth: input.targetHealth,
      nextArmor: input.targetArmor,
      isLethal: false,
    };
  }

  // Distance falloff curve
  const falloffRatio = Math.max(0.45, 1 - (input.distanceMeters / weapon.range) * 0.42);
  let rawDamage = weapon.damage * falloffRatio;
  if (input.isHeadshot) {
    rawDamage *= weapon.headshotMultiplier;
  }

  let healthDamage = rawDamage;
  let armorDamage = 0;

  if (input.targetArmor > 0) {
    const penetrated = rawDamage * weapon.armorPenetration;
    const absorbed = rawDamage - penetrated;
    armorDamage = Math.min(input.targetArmor, Math.ceil(absorbed * 0.75));
    healthDamage = penetrated;
  }

  const finalHealthDmg = Math.max(1, Math.round(healthDamage));
  const nextHealth = Math.max(0, input.targetHealth - finalHealthDmg);
  const nextArmor = Math.max(0, input.targetArmor - armorDamage);

  return {
    healthDamage: finalHealthDmg,
    armorDamage,
    nextHealth,
    nextArmor,
    isLethal: nextHealth === 0,
  };
}

export interface MatchRewardInput {
  kills: number;
  deaths: number;
  headshots: number;
  wonMatch: boolean;
  bombObjectives: number;
}

export function computeMatchRewards(input: MatchRewardInput): { xpEarned: number; creditsEarned: number } {
  const baseXp = input.wonMatch ? 240 : 110;
  const killXp = Math.max(0, input.kills) * 45;
  const hsXp = Math.max(0, input.headshots) * 20;
  const objXp = Math.max(0, input.bombObjectives) * 75;
  const xpEarned = baseXp + killXp + hsXp + objXp;

  const baseCredits = input.wonMatch ? 450 : 200;
  const killCredits = Math.max(0, input.kills) * 65;
  const objCredits = Math.max(0, input.bombObjectives) * 120;
  const creditsEarned = baseCredits + killCredits + objCredits;

  return { xpEarned, creditsEarned };
}

export interface AABBBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  tag?: string;
}

/**
 * Resolves horizontal cylinder/circle player collision against map AABB obstacles
 */
export function resolveHorizontalCollision(
  x: number,
  y: number,
  z: number,
  radius: number,
  boxes: AABBBox[],
  playerHeight = 1.7
): { x: number; z: number; collided: boolean } {
  let outX = x;
  let outZ = z;
  let collided = false;

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    // Skip if vertically disjoint
    if (y + playerHeight <= b.minY + 0.1 || y >= b.maxY - 0.05) {
      continue;
    }

    const closestX = Math.max(b.minX, Math.min(outX, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(outZ, b.maxZ));

    const dx = outX - closestX;
    const dz = outZ - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      collided = true;
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const overlap = radius - dist;
        outX += (dx / dist) * overlap;
        outZ += (dz / dist) * overlap;
      } else {
        // Inside box: push out along shallowest axis
        const penLeft = Math.abs(outX - b.minX);
        const penRight = Math.abs(b.maxX - outX);
        const penFront = Math.abs(outZ - b.minZ);
        const penBack = Math.abs(b.maxZ - outZ);
        const minPen = Math.min(penLeft, penRight, penFront, penBack);
        if (minPen === penLeft) outX = b.minX - radius;
        else if (minPen === penRight) outX = b.maxX + radius;
        else if (minPen === penFront) outZ = b.minZ - radius;
        else outZ = b.maxZ + radius;
      }
    }
  }

  return { x: outX, z: outZ, collided };
}

/**
 * Slab method Ray-AABB intersection returning distance t (or null if no hit within maxDist)
 */
export function intersectRayAABB(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  box: AABBBox,
  maxDist: number
): number | null {
  let tmin = 0;
  let tmax = maxDist;

  const axes: [number, number, number, number][] = [
    [ox, dx, box.minX, box.maxX],
    [oy, dy, box.minY, box.maxY],
    [oz, dz, box.minZ, box.maxZ],
  ];

  for (const [origin, dir, minB, maxB] of axes) {
    if (Math.abs(dir) < 1e-7) {
      if (origin < minB || origin > maxB) return null;
    } else {
      const invD = 1 / dir;
      let t1 = (minB - origin) * invD;
      let t2 = (maxB - origin) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }

  return tmin <= maxDist ? tmin : null;
}

export function validateStorePurchase(
  userCredits: number,
  ownedItemIds: string[],
  itemId: string
): { valid: boolean; reason?: string; remainingCredits: number } {
  const item = STORE_CATALOG.find((i) => i.id === itemId);
  if (!item) {
    return { valid: false, reason: 'ITEM_NOT_FOUND', remainingCredits: userCredits };
  }
  if (ownedItemIds.includes(itemId)) {
    return { valid: false, reason: 'ALREADY_OWNED', remainingCredits: userCredits };
  }
  if (userCredits < item.price) {
    return { valid: false, reason: 'INSUFFICIENT_CREDITS', remainingCredits: userCredits };
  }
  return { valid: true, remainingCredits: userCredits - item.price };
}
