import { AABBBox, BotDifficulty, intersectRayAABB, resolveHorizontalCollision } from './rules.ts';
import { findWaypointPath, TacticalMapConfig } from './maps.ts';
import { WEAPONS, WeaponId } from './weapons.ts';

export type BotTeam = 'vanguard' | 'phantom';
export type BotArchetype = 'assault' | 'anchor' | 'flanker' | 'sniper';
export type BotFSMState =
  | 'PATROL'
  | 'ADVANCE_OBJECTIVE'
  | 'INVESTIGATE_SOUND'
  | 'ENGAGE'
  | 'STRAFE_DUEL'
  | 'TAKE_COVER'
  | 'RELOAD'
  | 'THROW_UTILITY';

export interface BotActor {
  id: string;
  name: string;
  team: BotTeam;
  archetype: BotArchetype;
  difficulty: BotDifficulty;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  armor: number;
  alive: boolean;
  respawnTimer: number;
  koToppleProgress: number; // 0..1 smooth topple animation on death
  hitFlashTimer: number;
  primaryWeapon: WeaponId;
  secondaryWeapon: WeaponId;
  activeWeapon: WeaponId;
  magAmmo: number;
  reloadTimer: number;
  fireCooldown: number;
  telegraphTimer: number; // Visual/audio windup before firing burst
  blindTimer: number; // Flashbang stun duration
  grenadesRemaining: number;
  fsmState: BotFSMState;
  stateTimer: number;
  path: { x: number; z: number }[];
  pathIndex: number;
  targetActorId: string | null;
  alertLocation: { x: number; z: number } | null;
  strafeDir: number;
  kills: number;
  deaths: number;
  walkPhase: number;
}

export interface DifficultyProfile {
  reactionDelaySec: number;
  aimErrorRad: number;
  moveSpeed: number;
  strafeFrequency: number;
  burstLength: number;
  utilityChance: number;
}

export const BOT_DIFFICULTY_PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  Easy: {
    reactionDelaySec: 0.55,
    aimErrorRad: 0.11,
    moveSpeed: 5.2,
    strafeFrequency: 0.8,
    burstLength: 2,
    utilityChance: 0.1,
  },
  Normal: {
    reactionDelaySec: 0.35,
    aimErrorRad: 0.065,
    moveSpeed: 6.2,
    strafeFrequency: 1.4,
    burstLength: 4,
    utilityChance: 0.25,
  },
  Hard: {
    reactionDelaySec: 0.22,
    aimErrorRad: 0.032,
    moveSpeed: 7.0,
    strafeFrequency: 2.2,
    burstLength: 5,
    utilityChance: 0.45,
  },
  Expert: {
    reactionDelaySec: 0.14,
    aimErrorRad: 0.015,
    moveSpeed: 7.6,
    strafeFrequency: 3.0,
    burstLength: 6,
    utilityChance: 0.65,
  },
};

const CALLSIGNS_VANGUARD = [
  'ALBORZ-1',
  'SHAHIN-7',
  'DARIUSH-V',
  'CYRUS-CT',
  'KAVEH-OPS',
  'ROSTAM-9',
];

const CALLSIGNS_PHANTOM = [
  'PHANTOM-X',
  'SIAVASH-T',
  'ZAL-SHADOW',
  'ASHKAN-4',
  'BAHRAM-K',
  'SOHRAB-Zero',
];

export function createBotRoster(
  count: number,
  difficulty: BotDifficulty,
  mapConfig: TacticalMapConfig,
  playerTeam: BotTeam
): BotActor[] {
  const bots: BotActor[] = [];
  const archetypes: BotArchetype[] = ['assault', 'anchor', 'flanker', 'sniper'];

  let vanguardCount = playerTeam === 'vanguard' ? 1 : 0;
  let phantomCount = playerTeam === 'phantom' ? 1 : 0;

  for (let i = 0; i < count; i++) {
    const team: BotTeam = vanguardCount <= phantomCount ? 'vanguard' : 'phantom';
    if (team === 'vanguard') vanguardCount++;
    else phantomCount++;

    const archetype = archetypes[i % archetypes.length];
    const spawns = team === 'vanguard' ? mapConfig.vanguardSpawns : mapConfig.phantomSpawns;
    const sp = spawns[(i + 1) % spawns.length];

    let primaryWeapon: WeaponId = team === 'vanguard' ? 'm4a1' : 'ak47';
    if (archetype === 'sniper') primaryWeapon = 'awp';
    else if (archetype === 'flanker') primaryWeapon = i % 2 === 0 ? 'mp5' : 'shotgun';

    const secondaryWeapon: WeaponId = team === 'vanguard' ? 'usp' : 'glock';
    const nameList = team === 'vanguard' ? CALLSIGNS_VANGUARD : CALLSIGNS_PHANTOM;
    const name = `[BOT] ${nameList[i % nameList.length]}`;

    bots.push({
      id: `bot_${i + 1}`,
      name,
      team,
      archetype,
      difficulty,
      x: sp.x + (Math.random() - 0.5) * 2.0,
      y: 0,
      z: sp.z + (Math.random() - 0.5) * 2.0,
      vx: 0,
      vz: 0,
      yaw: sp.yaw,
      pitch: 0,
      health: 100,
      maxHealth: 100,
      armor: 100,
      alive: true,
      respawnTimer: 0,
      koToppleProgress: 0,
      hitFlashTimer: 0,
      primaryWeapon,
      secondaryWeapon,
      activeWeapon: primaryWeapon,
      magAmmo: WEAPONS[primaryWeapon].magCapacity,
      reloadTimer: 0,
      fireCooldown: 0.4,
      telegraphTimer: 0,
      blindTimer: 0,
      grenadesRemaining: 1,
      fsmState: 'PATROL',
      stateTimer: 0,
      path: [],
      pathIndex: 0,
      targetActorId: null,
      alertLocation: null,
      strafeDir: i % 2 === 0 ? 1 : -1,
      kills: 0,
      deaths: 0,
      walkPhase: Math.random() * Math.PI * 2,
    });
  }

  return bots;
}

export function hasLineOfSight(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  boxes: AABBBox[],
  smokeZones: { x: number; z: number; radius: number }[]
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.01) return true;

  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;

  // Check if blocked by smoke cloud
  for (const smoke of smokeZones) {
    // Project smoke center onto segment (x1,z1)->(x2,z2)
    const segLenSq = dx * dx + dz * dz;
    if (segLenSq > 0.01) {
      const t = Math.max(0, Math.min(1, ((smoke.x - x1) * dx + (smoke.z - z1) * dz) / segLenSq));
      const px = x1 + t * dx;
      const pz = z1 + t * dz;
      if (Math.hypot(px - smoke.x, pz - smoke.z) < smoke.radius) {
        return false;
      }
    }
  }

  for (let i = 0; i < boxes.length; i++) {
    const t = intersectRayAABB(x1, y1, z1, nx, ny, nz, boxes[i], dist - 0.1);
    if (t !== null && t < dist - 0.1) {
      return false;
    }
  }
  return true;
}

export interface BotTickContext {
  dt: number;
  mapConfig: TacticalMapConfig;
  collisionBoxes: AABBBox[];
  smokeZones: { x: number; z: number; radius: number }[];
  player: {
    id: string;
    team: BotTeam;
    x: number;
    y: number;
    z: number;
    alive: boolean;
  };
  allBots: BotActor[];
  isFreeForAll: boolean;
  bombPlantedAt: { x: number; z: number } | null;
  onBotFire: (bot: BotActor, targetId: string, aimX: number, aimY: number, aimZ: number) => void;
  onBotThrowSmokeOrGrenade: (bot: BotActor, targetX: number, targetZ: number, kind: 'grenade' | 'smoke') => void;
}

export function stepBotsAI(ctx: BotTickContext): void {
  const { dt, mapConfig, collisionBoxes, smokeZones, player, allBots, isFreeForAll, bombPlantedAt } = ctx;

  // Attack token pool: max 3 concurrent bots actively shooting at the player at the same instant
  let activeAttackersCount = 0;
  const MAX_CONCURRENT_ATTACKERS = 3;

  for (const bot of allBots) {
    if (bot.hitFlashTimer > 0) {
      bot.hitFlashTimer = Math.max(0, bot.hitFlashTimer - dt);
    }

    if (!bot.alive) {
      bot.koToppleProgress = Math.min(1, bot.koToppleProgress + dt * 3.2);
      bot.respawnTimer -= dt;
      if (bot.respawnTimer <= 0) {
        const spawns = bot.team === 'vanguard' ? mapConfig.vanguardSpawns : mapConfig.phantomSpawns;
        const sp = spawns[Math.floor(Math.random() * spawns.length)];
        bot.x = sp.x + (Math.random() - 0.5) * 2.5;
        bot.z = sp.z + (Math.random() - 0.5) * 2.5;
        bot.yaw = sp.yaw;
        bot.health = 100;
        bot.armor = 100;
        bot.alive = true;
        bot.koToppleProgress = 0;
        bot.activeWeapon = bot.primaryWeapon;
        bot.magAmmo = WEAPONS[bot.primaryWeapon].magCapacity;
        bot.reloadTimer = 0;
        bot.fsmState = 'PATROL';
        bot.path = [];
      }
      continue;
    }

    if (bot.blindTimer > 0) {
      bot.blindTimer = Math.max(0, bot.blindTimer - dt);
    }

    const profile = BOT_DIFFICULTY_PROFILES[bot.difficulty];

    // Reload handling
    if (bot.reloadTimer > 0) {
      bot.reloadTimer -= dt;
      if (bot.reloadTimer <= 0) {
        bot.magAmmo = WEAPONS[bot.activeWeapon].magCapacity;
        bot.fsmState = 'PATROL';
      }
    }

    // Find closest visible enemy
    let bestTarget: { id: string; x: number; y: number; z: number; dist: number } | null = null;
    if (bot.blindTimer <= 0.2) {
      // Check human player
      if (player.alive && (isFreeForAll || player.team !== bot.team)) {
        const dPlayer = Math.hypot(player.x - bot.x, player.z - bot.z);
        if (
          dPlayer <= WEAPONS[bot.activeWeapon].range &&
          hasLineOfSight(bot.x, 1.5, bot.z, player.x, player.y + 1.4, player.z, collisionBoxes, smokeZones)
        ) {
          bestTarget = { id: 'player', x: player.x, y: player.y + 1.35, z: player.z, dist: dPlayer };
        }
      }

      // Check other bots
      for (const other of allBots) {
        if (other.id === bot.id || !other.alive) continue;
        if (!isFreeForAll && other.team === bot.team) continue;
        const dBot = Math.hypot(other.x - bot.x, other.z - bot.z);
        if (bestTarget && dBot >= bestTarget.dist) continue;
        if (
          dBot <= WEAPONS[bot.activeWeapon].range &&
          hasLineOfSight(bot.x, 1.5, bot.z, other.x, 1.5, other.z, collisionBoxes, smokeZones)
        ) {
          bestTarget = { id: other.id, x: other.x, y: 1.4, z: other.z, dist: dBot };
        }
      }
    }

    // State Transitions
    if (bot.magAmmo <= 0 && bot.reloadTimer <= 0) {
      // Tactical weapon switch if enemy is very close (< 12m) and currently on primary
      if (bestTarget && bestTarget.dist < 12 && bot.activeWeapon === bot.primaryWeapon) {
        bot.activeWeapon = bot.secondaryWeapon;
        bot.magAmmo = WEAPONS[bot.secondaryWeapon].magCapacity;
      } else {
        bot.fsmState = 'RELOAD';
        bot.reloadTimer = WEAPONS[bot.activeWeapon].reloadTime;
      }
    } else if (bot.health < 28 && bestTarget && bot.archetype !== 'assault') {
      bot.fsmState = 'TAKE_COVER';
    } else if (bestTarget) {
      if (bot.fsmState !== 'ENGAGE' && bot.fsmState !== 'STRAFE_DUEL') {
        bot.fsmState = bot.archetype === 'anchor' || bot.archetype === 'sniper' ? 'ENGAGE' : 'STRAFE_DUEL';
        bot.telegraphTimer = profile.reactionDelaySec;
      }
      bot.targetActorId = bestTarget.id;
      bot.alertLocation = { x: bestTarget.x, z: bestTarget.z };
    } else if (bombPlantedAt) {
      bot.fsmState = 'ADVANCE_OBJECTIVE';
    } else if (bot.alertLocation) {
      bot.fsmState = 'INVESTIGATE_SOUND';
    } else {
      bot.fsmState = 'PATROL';
    }

    // Execute FSM behavior
    let moveTargetX = bot.x;
    let moveTargetZ = bot.z;
    let speedMultiplier = 1.0;

    if (bot.fsmState === 'ENGAGE' || bot.fsmState === 'STRAFE_DUEL') {
      if (bestTarget) {
        const desiredYaw = Math.atan2(bestTarget.x - bot.x, bestTarget.z - bot.z);
        // Smooth yaw interpolation
        const diff = Math.atan2(Math.sin(desiredYaw - bot.yaw), Math.cos(desiredYaw - bot.yaw));
        bot.yaw += diff * Math.min(1, dt * 10);

        // Archetype-specific combat movement policy (4 distinct policies)
        if (bot.archetype === 'assault') {
          // Policy 1: Aggressive push + side-step weave
          bot.stateTimer += dt * profile.strafeFrequency;
          const perpX = Math.cos(desiredYaw) * Math.sin(bot.stateTimer * 3) * 3.5;
          const perpZ = -Math.sin(desiredYaw) * Math.sin(bot.stateTimer * 3) * 3.5;
          moveTargetX = bestTarget.dist > 10 ? bestTarget.x + perpX : bot.x + perpX;
          moveTargetZ = bestTarget.dist > 10 ? bestTarget.z + perpZ : bot.z + perpZ;
          speedMultiplier = 0.85;
        } else if (bot.archetype === 'flanker') {
          // Policy 2: Wide orbital flanker
          bot.stateTimer += dt;
          if (bot.stateTimer > 1.6) {
            bot.strafeDir *= -1;
            bot.stateTimer = 0;
          }
          const tangentX = Math.cos(desiredYaw) * bot.strafeDir * 6;
          const tangentZ = -Math.sin(desiredYaw) * bot.strafeDir * 6;
          moveTargetX = bot.x + tangentX;
          moveTargetZ = bot.z + tangentZ;
          speedMultiplier = 0.95;
        } else if (bot.archetype === 'sniper') {
          // Policy 3: Long-range kiter / distance holder
          if (bestTarget.dist < 18) {
            moveTargetX = bot.x - Math.sin(desiredYaw) * 6;
            moveTargetZ = bot.z - Math.cos(desiredYaw) * 6;
            speedMultiplier = 0.75;
          } else {
            speedMultiplier = 0.15;
          }
        } else {
          // Policy 4: Anchor micro-strafe peek
          bot.stateTimer += dt * profile.strafeFrequency;
          moveTargetX = bot.x + Math.cos(desiredYaw) * Math.cos(bot.stateTimer * 2.5) * 2.2;
          moveTargetZ = bot.z - Math.sin(desiredYaw) * Math.cos(bot.stateTimer * 2.5) * 2.2;
          speedMultiplier = 0.55;
        }

        // Utility throw check (Grenade / Smoke)
        if (
          bot.grenadesRemaining > 0 &&
          bestTarget.dist > 14 &&
          bestTarget.dist < 30 &&
          Math.random() < profile.utilityChance * dt * 0.35
        ) {
          bot.grenadesRemaining--;
          ctx.onBotThrowSmokeOrGrenade(
            bot,
            bestTarget.x,
            bestTarget.z,
            bot.health < 45 ? 'smoke' : 'grenade'
          );
        }

        // Telegraph windup & firing with crowd token pool
        if (bot.telegraphTimer > 0) {
          bot.telegraphTimer -= dt;
        } else {
          bot.fireCooldown -= dt;
          if (bot.fireCooldown <= 0 && activeAttackersCount < MAX_CONCURRENT_ATTACKERS) {
            activeAttackersCount++;
            const weapon = WEAPONS[bot.activeWeapon];
            bot.fireCooldown = 60 / weapon.fireRateRPM + (bot.difficulty === 'Easy' ? 0.14 : 0.04);
            bot.magAmmo = Math.max(0, bot.magAmmo - 1);

            const errX = (Math.random() - 0.5) * 2 * profile.aimErrorRad * bestTarget.dist;
            const errY = (Math.random() - 0.5) * 1.5 * profile.aimErrorRad * bestTarget.dist;
            const errZ = (Math.random() - 0.5) * 2 * profile.aimErrorRad * bestTarget.dist;

            ctx.onBotFire(
              bot,
              bestTarget.id,
              bestTarget.x + errX,
              bestTarget.y + errY,
              bestTarget.z + errZ
            );
          }
        }
      }
    } else if (bot.fsmState === 'TAKE_COVER' || bot.fsmState === 'RELOAD') {
      // Find nearest cover waypoint
      const coverWps = mapConfig.waypoints.filter((w) => w.isCover);
      if (coverWps.length > 0 && bot.path.length === 0) {
        const nearest = coverWps.reduce((best, w) =>
          Math.hypot(w.x - bot.x, w.z - bot.z) < Math.hypot(best.x - bot.x, best.z - bot.z)
            ? w
            : best
        );
        bot.path = findWaypointPath(mapConfig.waypoints, bot.x, bot.z, nearest.x, nearest.z);
        bot.pathIndex = 0;
      }
      speedMultiplier = 0.9;
    } else if (bot.fsmState === 'ADVANCE_OBJECTIVE' && bombPlantedAt) {
      if (bot.path.length === 0) {
        bot.path = findWaypointPath(mapConfig.waypoints, bot.x, bot.z, bombPlantedAt.x, bombPlantedAt.z);
        bot.pathIndex = 0;
      }
      speedMultiplier = 1.0;
    } else if (bot.fsmState === 'INVESTIGATE_SOUND' && bot.alertLocation) {
      if (bot.path.length === 0) {
        bot.path = findWaypointPath(
          mapConfig.waypoints,
          bot.x,
          bot.z,
          bot.alertLocation.x,
          bot.alertLocation.z
        );
        bot.pathIndex = 0;
      }
      if (Math.hypot(bot.alertLocation.x - bot.x, bot.alertLocation.z - bot.z) < 3.5) {
        bot.alertLocation = null;
        bot.path = [];
      }
    } else {
      // PATROL: choose strategic waypoint based on archetype
      if (bot.path.length === 0 || bot.pathIndex >= bot.path.length) {
        const wps = mapConfig.waypoints;
        const candidate = wps[Math.floor(Math.random() * wps.length)];
        bot.path = findWaypointPath(mapConfig.waypoints, bot.x, bot.z, candidate.x, candidate.z);
        bot.pathIndex = 0;
      }
    }

    // Follow waypoint path if not actively dueling
    if (bot.fsmState !== 'ENGAGE' && bot.fsmState !== 'STRAFE_DUEL' && bot.path.length > 0) {
      const targetNode = bot.path[Math.min(bot.pathIndex, bot.path.length - 1)];
      moveTargetX = targetNode.x;
      moveTargetZ = targetNode.z;
      const distToNode = Math.hypot(moveTargetX - bot.x, moveTargetZ - bot.z);
      if (distToNode < 2.0) {
        bot.pathIndex++;
      } else {
        const desiredYaw = Math.atan2(moveTargetX - bot.x, moveTargetZ - bot.z);
        const diff = Math.atan2(Math.sin(desiredYaw - bot.yaw), Math.cos(desiredYaw - bot.yaw));
        bot.yaw += diff * Math.min(1, dt * 7);
      }
    }

    // Apply horizontal velocity and resolve collision
    const dx = moveTargetX - bot.x;
    const dz = moveTargetZ - bot.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.25) {
      const stepSpeed = profile.moveSpeed * speedMultiplier * WEAPONS[bot.activeWeapon].moveSpeedMultiplier;
      bot.vx = (dx / dist) * stepSpeed;
      bot.vz = (dz / dist) * stepSpeed;
      const nextX = bot.x + bot.vx * dt;
      const nextZ = bot.z + bot.vz * dt;
      const resolved = resolveHorizontalCollision(nextX, bot.y, nextZ, 0.55, collisionBoxes);
      const movedDist = Math.hypot(resolved.x - bot.x, resolved.z - bot.z);
      bot.x = resolved.x;
      bot.z = resolved.z;
      bot.walkPhase += movedDist * 2.6;
      if (resolved.collided && bot.path.length > 0) {
        // Nudge around obstacle corner
        bot.pathIndex = Math.min(bot.path.length - 1, bot.pathIndex + 1);
      }
    } else {
      bot.vx = 0;
      bot.vz = 0;
    }
  }
}

export function broadcastSoundAlertToBots(
  allBots: BotActor[],
  sourceTeam: BotTeam,
  isFreeForAll: boolean,
  x: number,
  z: number,
  radiusMeters: number
): void {
  for (const bot of allBots) {
    if (!bot.alive) continue;
    if (!isFreeForAll && bot.team === sourceTeam) continue;
    if (Math.hypot(bot.x - x, bot.z - z) <= radiusMeters) {
      bot.alertLocation = { x, z };
    }
  }
}
