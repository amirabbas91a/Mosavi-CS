import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRankFromXp,
  calculateLevelFromXp,
  calculateKDRatio,
  computeWeaponDamage,
  computeMatchRewards,
  resolveHorizontalCollision,
  intersectRayAABB,
  validateStorePurchase,
} from './rules';
import { MAPS, findWaypointPath, buildMapCollisionBoxes } from './maps';

test('rank progression thresholds map XP accurately to MOSAVI CS tiers', () => {
  assert.equal(calculateRankFromXp(0), 'Rookie');
  assert.equal(calculateRankFromXp(1200), 'Bronze');
  assert.equal(calculateRankFromXp(3000), 'Silver');
  assert.equal(calculateRankFromXp(6000), 'Gold');
  assert.equal(calculateRankFromXp(9500), 'Platinum');
  assert.equal(calculateRankFromXp(14000), 'Diamond');
  assert.equal(calculateRankFromXp(19000), 'Elite');
  assert.equal(calculateRankFromXp(26000), 'MOSAVI Legend');
  assert.equal(calculateLevelFromXp(1100), 3);
  assert.equal(calculateKDRatio(24, 12), 2);
});

test('weapon damage & armor penetration calculates headshots and lethality', () => {
  // AWP headshot is instant lethal even against 100 armor
  const awpHs = computeWeaponDamage({
    weaponId: 'awp',
    distanceMeters: 45,
    isHeadshot: true,
    targetHealth: 100,
    targetArmor: 100,
  });
  assert.equal(awpHs.isLethal, true);
  assert.equal(awpHs.nextHealth, 0);

  // AK-47 close-range headshot is lethal (>100 health damage)
  const akHs = computeWeaponDamage({
    weaponId: 'ak47',
    distanceMeters: 15,
    isHeadshot: true,
    targetHealth: 100,
    targetArmor: 0,
  });
  assert.equal(akHs.isLethal, true);
});

test('horizontal AABB collision pushes player out of walls and Ray-AABB detects hits', () => {
  const boxes = buildMapCollisionBoxes(MAPS.mosavi_dust);
  // Attempting to stand inside the central citadel tower (-11, 0) pushes the player out
  const res = resolveHorizontalCollision(-8.0, 0, 0, 0.6, boxes);
  assert.equal(res.collided, true);
  assert.ok(res.x > -8.0);

  // Raycast from origin (0, 1.5, 10) straight north along -Z through open Mid alley should not hit the tower at x=-11
  const towerBox = boxes.find((b) => b.tag === 'citadel_tower')!;
  const miss = intersectRayAABB(0, 1.5, 10, 0, 0, -1, towerBox, 30);
  assert.equal(miss, null);

  // Raycast aimed directly at citadel tower (-11, 1.5, 10) along -Z hits the tower
  const hit = intersectRayAABB(-11, 1.5, 10, 0, 0, -1, towerBox, 30);
  assert.ok(hit !== null && hit > 0 && hit < 10);
});

test('A* waypoint pathfinding connects Vanguard spawn to Phantom spawn across all 3 maps', () => {
  for (const map of Object.values(MAPS)) {
    const path = findWaypointPath(map.waypoints, 0, 34, 0, -34);
    assert.ok(path.length >= 3, `Map ${map.id} should produce a multi-node tactical path`);
  }
});

test('store purchase validation checks credits and duplicate ownership', () => {
  const ok = validateStorePurchase(5000, [], 'skin_ak_crimson');
  assert.equal(ok.valid, true);
  assert.equal(ok.remainingCredits, 3800);

  const dup = validateStorePurchase(5000, ['skin_ak_crimson'], 'skin_ak_crimson');
  assert.equal(dup.valid, false);
  assert.equal(dup.reason, 'ALREADY_OWNED');

  const poor = validateStorePurchase(400, [], 'skin_awp_obsidian');
  assert.equal(poor.valid, false);
  assert.equal(poor.reason, 'INSUFFICIENT_CREDITS');
});

test('match reward calculation scales with kills, headshots, and objectives', () => {
  const reward = computeMatchRewards({
    kills: 10,
    deaths: 4,
    headshots: 5,
    wonMatch: true,
    bombObjectives: 2,
  });
  assert.ok(reward.xpEarned >= 800);
  assert.ok(reward.creditsEarned >= 1200);
});
