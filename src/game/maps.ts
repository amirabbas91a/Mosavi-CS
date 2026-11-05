import { AABBBox } from './rules.ts';

export type MapId = 'mosavi_dust' | 'mosavi_city' | 'mosavi_base';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface MapStructureBlock {
  id: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind: 'wall' | 'building' | 'crate' | 'pillar' | 'tower' | 'arch' | 'sandbag' | 'platform' | 'container';
  materialTheme: 'sandstone' | 'concrete' | 'metal' | 'wood' | 'dark_steel' | 'hazard';
}

export interface NavWaypoint {
  id: string;
  x: number;
  z: number;
  neighbors: string[];
  isCover?: boolean;
  siteTag?: 'A' | 'B' | 'MID' | 'SPAWN_CT' | 'SPAWN_T';
}

export interface TacticalMapConfig {
  id: MapId;
  name: string;
  nameFa: string;
  subtitleEn: string;
  subtitleFa: string;
  skyColorHex: number;
  fogColorHex: number;
  fogDensity: number;
  sunColorHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  groundColorHex: number;
  arenaHalfSize: number;
  vanguardSpawns: { x: number; z: number; yaw: number }[];
  phantomSpawns: { x: number; z: number; yaw: number }[];
  bombSiteA: { x: number; z: number; radius: number };
  bombSiteB: { x: number; z: number; radius: number };
  structures: MapStructureBlock[];
  waypoints: NavWaypoint[];
}

export const MAPS: Record<MapId, TacticalMapConfig> = {
  mosavi_dust: {
    id: 'mosavi_dust',
    name: 'MOSAVI DUST',
    nameFa: 'موسوی داست (MOSAVI DUST)',
    subtitleEn: 'Arid Sandstone Citadel · Dual Bomb Sites · Long A & Mid Alley',
    subtitleFa: 'قلعه بیابانی و کوچه‌های استراتژیک · سایت‌های بمب A و B · میدان دید باز',
    skyColorHex: 0xd9b382,
    fogColorHex: 0xcfa574,
    fogDensity: 0.0085,
    sunColorHex: 0xfff0d4,
    sunIntensity: 2.6,
    hemiSkyHex: 0xffe4b5,
    hemiGroundHex: 0x7c5836,
    groundColorHex: 0xc29b68,
    arenaHalfSize: 48,
    vanguardSpawns: [
      { x: 0, z: 36, yaw: 0 },
      { x: -6.5, z: 35, yaw: 0 },
      { x: 6.5, z: 35, yaw: 0 },
      { x: -11, z: 33, yaw: -0.15 },
      { x: 11, z: 33, yaw: 0.15 },
    ],
    phantomSpawns: [
      { x: 0, z: -36, yaw: Math.PI },
      { x: -6.5, z: -35, yaw: Math.PI },
      { x: 6.5, z: -35, yaw: Math.PI },
      { x: -11, z: -33, yaw: Math.PI + 0.15 },
      { x: 11, z: -33, yaw: Math.PI - 0.15 },
    ],
    bombSiteA: { x: -24, z: 18, radius: 5.5 },
    bombSiteB: { x: 24, z: 18, radius: 5.5 },
    structures: [
      // Outer tactical sandstone compound walls (with natural desert cliffs beyond)
      { id: 'wall_n', x: 0, y: 3.5, z: -45, w: 90, h: 7, d: 2, kind: 'wall', materialTheme: 'sandstone' },
      { id: 'wall_s', x: 0, y: 3.5, z: 45, w: 90, h: 7, d: 2, kind: 'wall', materialTheme: 'sandstone' },
      { id: 'wall_w', x: -45, y: 3.5, z: 0, w: 2, h: 7, d: 90, kind: 'wall', materialTheme: 'sandstone' },
      { id: 'wall_e', x: 45, y: 3.5, z: 0, w: 2, h: 7, d: 90, kind: 'wall', materialTheme: 'sandstone' },

      // Central Citadel Landmark Tower (visible immediately from spawn)
      { id: 'citadel_tower', x: -11, y: 6.5, z: 0, w: 7, h: 13, d: 7, kind: 'tower', materialTheme: 'sandstone' },
      { id: 'citadel_east', x: 11, y: 4.5, z: 0, w: 7, h: 9, d: 7, kind: 'building', materialTheme: 'sandstone' },
      // Mid Overhead Archway Beam connecting the two central structures (open passage underneath)
      { id: 'mid_arch_beam', x: 0, y: 7.2, z: 0, w: 15, h: 2.4, d: 4, kind: 'arch', materialTheme: 'sandstone' },

      // West Alley (Long A Buildings)
      { id: 'bld_a1', x: -26, y: 4, z: -12, w: 10, h: 8, d: 12, kind: 'building', materialTheme: 'sandstone' },
      { id: 'bld_a2', x: -34, y: 3.5, z: 8, w: 6, h: 7, d: 10, kind: 'building', materialTheme: 'sandstone' },
      // Site A Cover Crates
      { id: 'crate_a1', x: -24, y: 1.1, z: 18, w: 2.4, h: 2.2, d: 2.4, kind: 'crate', materialTheme: 'wood' },
      { id: 'crate_a2', x: -21.5, y: 0.9, z: 19.5, w: 1.8, h: 1.8, d: 1.8, kind: 'crate', materialTheme: 'metal' },
      { id: 'sandbag_a', x: -18, y: 0.7, z: 12, w: 3.6, h: 1.4, d: 1.2, kind: 'sandbag', materialTheme: 'sandstone' },

      // East Alley (B Tunnels & Courtyard)
      { id: 'bld_b1', x: 26, y: 4, z: -12, w: 10, h: 8, d: 12, kind: 'building', materialTheme: 'sandstone' },
      { id: 'bld_b2', x: 34, y: 3.5, z: 8, w: 6, h: 7, d: 10, kind: 'building', materialTheme: 'sandstone' },
      // Site B Cover Crates
      { id: 'crate_b1', x: 24, y: 1.1, z: 18, w: 2.4, h: 2.2, d: 2.4, kind: 'crate', materialTheme: 'wood' },
      { id: 'crate_b2', x: 26.5, y: 0.9, z: 16.5, w: 1.8, h: 1.8, d: 1.8, kind: 'crate', materialTheme: 'metal' },
      { id: 'pillar_b1', x: 18, y: 2.5, z: 24, w: 2.2, h: 5, d: 2.2, kind: 'pillar', materialTheme: 'sandstone' },

      // Mid Tactical Cover & Flank Shields (Leaving center lane clear for long-range sightline)
      { id: 'mid_crate_n', x: -4.2, y: 1.0, z: -16, w: 2.2, h: 2.0, d: 2.2, kind: 'crate', materialTheme: 'wood' },
      { id: 'mid_crate_s', x: 4.2, y: 1.0, z: 16, w: 2.2, h: 2.0, d: 2.2, kind: 'crate', materialTheme: 'wood' },
      { id: 'spawn_shield_s', x: -7.5, y: 1.6, z: 26, w: 4.5, h: 3.2, d: 1.5, kind: 'wall', materialTheme: 'sandstone' },
      { id: 'spawn_shield_n', x: 7.5, y: 1.6, z: -26, w: 4.5, h: 3.2, d: 1.5, kind: 'wall', materialTheme: 'sandstone' },
    ],
    waypoints: [
      { id: 'ct_spawn', x: 0, z: 34, neighbors: ['ct_left', 'ct_right', 'mid_s'], siteTag: 'SPAWN_CT' },
      { id: 'ct_left', x: -16, z: 28, neighbors: ['ct_spawn', 'site_a', 'mid_s'], isCover: true },
      { id: 'ct_right', x: 16, z: 28, neighbors: ['ct_spawn', 'site_b', 'mid_s'], isCover: true },
      { id: 'site_a', x: -22, z: 15, neighbors: ['ct_left', 'a_long', 'mid_w'], siteTag: 'A', isCover: true },
      { id: 'site_b', x: 22, z: 15, neighbors: ['ct_right', 'b_long', 'mid_e'], siteTag: 'B', isCover: true },
      { id: 'mid_s', x: 0, z: 12, neighbors: ['ct_spawn', 'ct_left', 'ct_right', 'mid_center'], siteTag: 'MID' },
      { id: 'mid_center', x: 0, z: 0, neighbors: ['mid_s', 'mid_n', 'mid_w', 'mid_e'], siteTag: 'MID', isCover: true },
      { id: 'mid_w', x: -16, z: 0, neighbors: ['mid_center', 'site_a', 'a_long'], isCover: true },
      { id: 'mid_e', x: 16, z: 0, neighbors: ['mid_center', 'site_b', 'b_long'], isCover: true },
      { id: 'mid_n', x: 0, z: -12, neighbors: ['mid_center', 't_left', 't_right', 't_spawn'], siteTag: 'MID' },
      { id: 'a_long', x: -16, z: -20, neighbors: ['site_a', 'mid_w', 't_left'], isCover: true },
      { id: 'b_long', x: 16, z: -20, neighbors: ['site_b', 'mid_e', 't_right'], isCover: true },
      { id: 't_left', x: -12, z: -30, neighbors: ['a_long', 'mid_n', 't_spawn'] },
      { id: 't_right', x: 12, z: -30, neighbors: ['b_long', 'mid_n', 't_spawn'] },
      { id: 't_spawn', x: 0, z: -34, neighbors: ['t_left', 't_right', 'mid_n'], siteTag: 'SPAWN_T' },
    ],
  },

  mosavi_city: {
    id: 'mosavi_city',
    name: 'MOSAVI CITY',
    nameFa: 'موسوی سیتی (MOSAVI CITY)',
    subtitleEn: 'Metropolitan Tactical Sector · High-Rise Overpasses & Plaza',
    subtitleFa: 'محیط شهری مدرن · ساختمان‌های چندطبقه و خیابان‌های تاکتیکی',
    skyColorHex: 0x1e293b,
    fogColorHex: 0x1e293b,
    fogDensity: 0.009,
    sunColorHex: 0xe0f2fe,
    sunIntensity: 2.2,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x1e293b,
    groundColorHex: 0x334155,
    arenaHalfSize: 48,
    vanguardSpawns: [
      { x: 0, z: 36, yaw: 0 },
      { x: -5, z: 36, yaw: 0 },
      { x: 5, z: 36, yaw: 0 },
      { x: -9, z: 34, yaw: -0.1 },
      { x: 9, z: 34, yaw: 0.1 },
    ],
    phantomSpawns: [
      { x: 0, z: -36, yaw: Math.PI },
      { x: -5, z: -36, yaw: Math.PI },
      { x: 5, z: -36, yaw: Math.PI },
      { x: -9, z: -34, yaw: Math.PI + 0.1 },
      { x: 9, z: -34, yaw: Math.PI - 0.1 },
    ],
    bombSiteA: { x: -24, z: 14, radius: 5.5 },
    bombSiteB: { x: 24, z: 14, radius: 5.5 },
    structures: [
      { id: 'c_wall_n', x: 0, y: 4, z: -45, w: 90, h: 8, d: 2, kind: 'wall', materialTheme: 'concrete' },
      { id: 'c_wall_s', x: 0, y: 4, z: 45, w: 90, h: 8, d: 2, kind: 'wall', materialTheme: 'concrete' },
      { id: 'c_wall_w', x: -45, y: 4, z: 0, w: 2, h: 8, d: 90, kind: 'wall', materialTheme: 'concrete' },
      { id: 'c_wall_e', x: 45, y: 4, z: 0, w: 2, h: 8, d: 90, kind: 'wall', materialTheme: 'concrete' },

      // Central Financial Tower & Skybridge
      { id: 'city_hq_w', x: -12, y: 7, z: -2, w: 8, h: 14, d: 10, kind: 'tower', materialTheme: 'concrete' },
      { id: 'city_hq_e', x: 12, y: 7, z: -2, w: 8, h: 14, d: 10, kind: 'tower', materialTheme: 'concrete' },
      { id: 'city_skybridge', x: 0, y: 8.5, z: -2, w: 16, h: 2.5, d: 5, kind: 'arch', materialTheme: 'dark_steel' },

      // West Boulevard & Shipping Containers
      { id: 'city_cont_a1', x: -26, y: 1.5, z: -14, w: 3.2, h: 3.0, d: 7.5, kind: 'container', materialTheme: 'hazard' },
      { id: 'city_bld_a2', x: -34, y: 5, z: 4, w: 7, h: 10, d: 14, kind: 'building', materialTheme: 'concrete' },
      { id: 'city_crate_a', x: -24, y: 1.1, z: 14, w: 2.5, h: 2.2, d: 2.5, kind: 'crate', materialTheme: 'metal' },

      // East Metro Plaza
      { id: 'city_bld_b1', x: 27, y: 5, z: -14, w: 9, h: 10, d: 11, kind: 'building', materialTheme: 'concrete' },
      { id: 'city_cont_b2', x: 32, y: 1.5, z: 6, w: 3.2, h: 3.0, d: 7.5, kind: 'container', materialTheme: 'metal' },
      { id: 'city_crate_b', x: 24, y: 1.1, z: 14, w: 2.5, h: 2.2, d: 2.5, kind: 'crate', materialTheme: 'metal' },

      // Central Plaza Pillars & Tactical Barriers
      { id: 'city_pillar_1', x: -4, y: 2.5, z: 14, w: 2, h: 5, d: 2, kind: 'pillar', materialTheme: 'concrete' },
      { id: 'city_pillar_2', x: 4, y: 2.5, z: -14, w: 2, h: 5, d: 2, kind: 'pillar', materialTheme: 'concrete' },
      { id: 'city_barrier_s', x: 0, y: 1.2, z: 26, w: 5.5, h: 2.4, d: 1.4, kind: 'sandbag', materialTheme: 'dark_steel' },
      { id: 'city_barrier_n', x: 0, y: 1.2, z: -26, w: 5.5, h: 2.4, d: 1.4, kind: 'sandbag', materialTheme: 'dark_steel' },
    ],
    waypoints: [
      { id: 'ct_spawn', x: 0, z: 34, neighbors: ['ct_left', 'ct_right', 'mid_s'], siteTag: 'SPAWN_CT' },
      { id: 'ct_left', x: -16, z: 26, neighbors: ['ct_spawn', 'site_a', 'mid_s'], isCover: true },
      { id: 'ct_right', x: 16, z: 26, neighbors: ['ct_spawn', 'site_b', 'mid_s'], isCover: true },
      { id: 'site_a', x: -20, z: 14, neighbors: ['ct_left', 'a_long', 'mid_w'], siteTag: 'A', isCover: true },
      { id: 'site_b', x: 20, z: 14, neighbors: ['ct_right', 'b_long', 'mid_e'], siteTag: 'B', isCover: true },
      { id: 'mid_s', x: 0, z: 10, neighbors: ['ct_spawn', 'ct_left', 'ct_right', 'mid_center'], siteTag: 'MID' },
      { id: 'mid_center', x: 0, z: 0, neighbors: ['mid_s', 'mid_n', 'mid_w', 'mid_e'], siteTag: 'MID', isCover: true },
      { id: 'mid_w', x: -18, z: 0, neighbors: ['mid_center', 'site_a', 'a_long'], isCover: true },
      { id: 'mid_e', x: 18, z: 0, neighbors: ['mid_center', 'site_b', 'b_long'], isCover: true },
      { id: 'mid_n', x: 0, z: -10, neighbors: ['mid_center', 't_left', 't_right', 't_spawn'], siteTag: 'MID' },
      { id: 'a_long', x: -18, z: -20, neighbors: ['site_a', 'mid_w', 't_left'], isCover: true },
      { id: 'b_long', x: 18, z: -20, neighbors: ['site_b', 'mid_e', 't_right'], isCover: true },
      { id: 't_left', x: -12, z: -30, neighbors: ['a_long', 'mid_n', 't_spawn'] },
      { id: 't_right', x: 12, z: -30, neighbors: ['b_long', 'mid_n', 't_spawn'] },
      { id: 't_spawn', x: 0, z: -34, neighbors: ['t_left', 't_right', 'mid_n'], siteTag: 'SPAWN_T' },
    ],
  },

  mosavi_base: {
    id: 'mosavi_base',
    name: 'MOSAVI BASE',
    nameFa: 'پایگاه نظامی (MOSAVI BASE)',
    subtitleEn: 'Fortified Command Compound · Watchtower, Hangars & Flank Lanes',
    subtitleFa: 'پایگاه نظامی استراتژیک · انبارهای تسلیحات، برج مراقبت و مسیرهای نفوذ',
    skyColorHex: 0x0f172a,
    fogColorHex: 0x111827,
    fogDensity: 0.0095,
    sunColorHex: 0xfde68a,
    sunIntensity: 2.3,
    hemiSkyHex: 0x64748b,
    hemiGroundHex: 0x0f172a,
    groundColorHex: 0x1f2937,
    arenaHalfSize: 48,
    vanguardSpawns: [
      { x: 0, z: 36, yaw: 0 },
      { x: -5, z: 36, yaw: 0 },
      { x: 5, z: 36, yaw: 0 },
      { x: -9, z: 34, yaw: -0.1 },
      { x: 9, z: 34, yaw: 0.1 },
    ],
    phantomSpawns: [
      { x: 0, z: -36, yaw: Math.PI },
      { x: -5, z: -36, yaw: Math.PI },
      { x: 5, z: -36, yaw: Math.PI },
      { x: -9, z: -34, yaw: Math.PI + 0.1 },
      { x: 9, z: -34, yaw: Math.PI - 0.1 },
    ],
    bombSiteA: { x: -24, z: 16, radius: 5.5 },
    bombSiteB: { x: 24, z: 16, radius: 5.5 },
    structures: [
      { id: 'b_wall_n', x: 0, y: 4, z: -45, w: 90, h: 8, d: 2, kind: 'wall', materialTheme: 'dark_steel' },
      { id: 'b_wall_s', x: 0, y: 4, z: 45, w: 90, h: 8, d: 2, kind: 'wall', materialTheme: 'dark_steel' },
      { id: 'b_wall_w', x: -45, y: 4, z: 0, w: 2, h: 8, d: 90, kind: 'wall', materialTheme: 'dark_steel' },
      { id: 'b_wall_e', x: 45, y: 4, z: 0, w: 2, h: 8, d: 90, kind: 'wall', materialTheme: 'dark_steel' },

      // Central Watchtower & Radar Structure
      { id: 'base_watchtower', x: -10, y: 7.5, z: 0, w: 6, h: 15, d: 6, kind: 'tower', materialTheme: 'dark_steel' },
      { id: 'base_radar_bunker', x: 10, y: 4, z: 0, w: 8, h: 8, d: 8, kind: 'building', materialTheme: 'concrete' },
      { id: 'base_gantry', x: 0, y: 7.5, z: 0, w: 14, h: 2, d: 3.5, kind: 'arch', materialTheme: 'hazard' },

      // Hangar A (West Wing)
      { id: 'hangar_a_w', x: -28, y: 4.5, z: -10, w: 9, h: 9, d: 14, kind: 'building', materialTheme: 'dark_steel' },
      { id: 'hangar_a_crate1', x: -24, y: 1.2, z: 16, w: 2.6, h: 2.4, d: 2.6, kind: 'crate', materialTheme: 'hazard' },
      { id: 'hangar_a_crate2', x: -20, y: 1.0, z: 18, w: 2.0, h: 2.0, d: 2.0, kind: 'crate', materialTheme: 'metal' },

      // Hangar B (East Wing)
      { id: 'hangar_b_e', x: 28, y: 4.5, z: -10, w: 9, h: 9, d: 14, kind: 'building', materialTheme: 'dark_steel' },
      { id: 'hangar_b_crate1', x: 24, y: 1.2, z: 16, w: 2.6, h: 2.4, d: 2.6, kind: 'crate', materialTheme: 'hazard' },
      { id: 'hangar_b_crate2', x: 20, y: 1.0, z: 18, w: 2.0, h: 2.0, d: 2.0, kind: 'crate', materialTheme: 'metal' },

      // Secret Flank Corridors & Mid Bunkers
      { id: 'flank_wall_w', x: -36, y: 3, z: 10, w: 4, h: 6, d: 12, kind: 'wall', materialTheme: 'concrete' },
      { id: 'flank_wall_e', x: 36, y: 3, z: 10, w: 4, h: 6, d: 12, kind: 'wall', materialTheme: 'concrete' },
      { id: 'base_mid_cover_1', x: -3.5, y: 1.1, z: -14, w: 2.8, h: 2.2, d: 1.8, kind: 'container', materialTheme: 'metal' },
      { id: 'base_mid_cover_2', x: 3.5, y: 1.1, z: 14, w: 2.8, h: 2.2, d: 1.8, kind: 'container', materialTheme: 'metal' },
    ],
    waypoints: [
      { id: 'ct_spawn', x: 0, z: 34, neighbors: ['ct_left', 'ct_right', 'mid_s'], siteTag: 'SPAWN_CT' },
      { id: 'ct_left', x: -16, z: 26, neighbors: ['ct_spawn', 'site_a', 'mid_s'], isCover: true },
      { id: 'ct_right', x: 16, z: 26, neighbors: ['ct_spawn', 'site_b', 'mid_s'], isCover: true },
      { id: 'site_a', x: -20, z: 15, neighbors: ['ct_left', 'a_long', 'mid_w'], siteTag: 'A', isCover: true },
      { id: 'site_b', x: 20, z: 15, neighbors: ['ct_right', 'b_long', 'mid_e'], siteTag: 'B', isCover: true },
      { id: 'mid_s', x: 0, z: 10, neighbors: ['ct_spawn', 'ct_left', 'ct_right', 'mid_center'], siteTag: 'MID' },
      { id: 'mid_center', x: 0, z: 0, neighbors: ['mid_s', 'mid_n', 'mid_w', 'mid_e'], siteTag: 'MID', isCover: true },
      { id: 'mid_w', x: -17, z: 0, neighbors: ['mid_center', 'site_a', 'a_long'], isCover: true },
      { id: 'mid_e', x: 17, z: 0, neighbors: ['mid_center', 'site_b', 'b_long'], isCover: true },
      { id: 'mid_n', x: 0, z: -10, neighbors: ['mid_center', 't_left', 't_right', 't_spawn'], siteTag: 'MID' },
      { id: 'a_long', x: -17, z: -20, neighbors: ['site_a', 'mid_w', 't_left'], isCover: true },
      { id: 'b_long', x: 17, z: -20, neighbors: ['site_b', 'mid_e', 't_right'], isCover: true },
      { id: 't_left', x: -12, z: -30, neighbors: ['a_long', 'mid_n', 't_spawn'] },
      { id: 't_right', x: 12, z: -30, neighbors: ['b_long', 'mid_n', 't_spawn'] },
      { id: 't_spawn', x: 0, z: -34, neighbors: ['t_left', 't_right', 't_spawn'], siteTag: 'SPAWN_T' },
    ],
  },
};

export const MAP_LIST: TacticalMapConfig[] = Object.values(MAPS);

export function buildMapCollisionBoxes(mapConfig: TacticalMapConfig): AABBBox[] {
  return mapConfig.structures.map((s) => ({
    minX: s.x - s.w / 2,
    maxX: s.x + s.w / 2,
    minY: s.y - s.h / 2,
    maxY: s.y + s.h / 2,
    minZ: s.z - s.d / 2,
    maxZ: s.z + s.d / 2,
    tag: s.id,
  }));
}

/**
 * A* Pathfinding over a map's Tactical Navigation Waypoints
 */
export function findWaypointPath(
  waypoints: NavWaypoint[],
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number
): { x: number; z: number }[] {
  if (waypoints.length === 0) return [{ x: goalX, z: goalZ }];

  const byId = new Map<string, NavWaypoint>();
  for (const wp of waypoints) byId.set(wp.id, wp);

  let startWp = waypoints[0];
  let goalWp = waypoints[0];
  let bestStartDist = Infinity;
  let bestGoalDist = Infinity;

  for (const wp of waypoints) {
    const ds = (wp.x - startX) ** 2 + (wp.z - startZ) ** 2;
    if (ds < bestStartDist) {
      bestStartDist = ds;
      startWp = wp;
    }
    const dg = (wp.x - goalX) ** 2 + (wp.z - goalZ) ** 2;
    if (dg < bestGoalDist) {
      bestGoalDist = dg;
      goalWp = wp;
    }
  }

  if (startWp.id === goalWp.id) {
    return [{ x: goalX, z: goalZ }];
  }

  const openSet = new Set<string>([startWp.id]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  for (const wp of waypoints) {
    gScore.set(wp.id, Infinity);
    fScore.set(wp.id, Infinity);
  }

  const heuristic = (a: NavWaypoint, b: NavWaypoint) =>
    Math.hypot(a.x - b.x, a.z - b.z);

  gScore.set(startWp.id, 0);
  fScore.set(startWp.id, heuristic(startWp, goalWp));

  while (openSet.size > 0) {
    let currentId = '';
    let lowestF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        currentId = id;
      }
    }

    if (!currentId) break;
    if (currentId === goalWp.id) {
      const path: { x: number; z: number }[] = [{ x: goalX, z: goalZ }];
      let curr: string | undefined = currentId;
      while (curr) {
        const node = byId.get(curr);
        if (node) path.unshift({ x: node.x, z: node.z });
        curr = cameFrom.get(curr);
      }
      return path;
    }

    openSet.delete(currentId);
    const currentWp = byId.get(currentId);
    if (!currentWp) continue;

    for (const neighborId of currentWp.neighbors) {
      const neighborWp = byId.get(neighborId);
      if (!neighborWp) continue;
      const tentativeG =
        (gScore.get(currentId) ?? Infinity) + heuristic(currentWp, neighborWp);
      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + heuristic(neighborWp, goalWp));
        openSet.add(neighborId);
      }
    }
  }

  return [
    { x: startWp.x, z: startWp.z },
    { x: goalX, z: goalZ },
  ];
}
