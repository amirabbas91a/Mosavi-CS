import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MAPS, MapId, buildMapCollisionBoxes } from '../game/maps.ts';
import {
  BotDifficulty,
  GameModeId,
  GAME_MODES,
  computeWeaponDamage,
  intersectRayAABB,
  resolveHorizontalCollision,
} from '../game/rules.ts';
import { WEAPONS, WeaponId } from '../game/weapons.ts';
import {
  BotActor,
  BotTeam,
  broadcastSoundAlertToBots,
  createBotRoster,
  stepBotsAI,
} from '../game/botAI.ts';
import {
  OperatorMeshRig,
  buildFirstPersonWeaponModel,
  buildTacticalMapGroup,
  createOperatorCharacterMesh,
  detectSoftwareWebGL,
} from '../game/sceneBuilder.ts';
import { soundEngine } from '../game/soundEngine.ts';

export type GameShellState = 'title' | 'playing' | 'paused' | 'gameover';

export interface KillFeedEntry {
  id: string;
  killer: string;
  victim: string;
  weaponId: WeaponId;
  headshot: boolean;
  team: BotTeam;
}

export interface HudSnapshot {
  health: number;
  armor: number;
  activeWeapon: WeaponId;
  primaryWeapon: WeaponId;
  secondaryWeapon: WeaponId;
  magAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  isAiming: boolean;
  isCrouching: boolean;
  cash: number;
  vanguardScore: number;
  phantomScore: number;
  timeRemainingSec: number;
  playerKills: number;
  playerDeaths: number;
  playerHeadshots: number;
  bombState: 'none' | 'planted' | 'defused' | 'exploded';
  bombCountdownSec: number;
  nearBombSite: 'A' | 'B' | null;
  actionProgress: number; // 0..1 planting/defusing bar
  flashAlpha: number; // 0..1 flashbang screen whiteout
  hitMarkerType: 'none' | 'hit' | 'headshot' | 'kill';
  damageIndicatorAlpha: number;
  radarEntities: { x: number; z: number; team: BotTeam; isPlayer?: boolean; isBomb?: boolean }[];
  playerX: number;
  playerZ: number;
  playerYaw: number;
  killFeed: KillFeedEntry[];
  botsScoreboard: {
    id: string;
    name: string;
    team: BotTeam;
    kills: number;
    deaths: number;
    alive: boolean;
  }[];
}

export interface GraphicsSettings {
  preset: 'Low' | 'Medium' | 'High' | 'Ultra';
  fov: number;
  sensitivity: number;
  volume: number;
  bloodEnabled: boolean;
  fpsLimit: 60 | 120 | 144;
}

export interface ExternalControlBridge {
  switchWeaponSlot: (slot: 1 | 2 | 3 | 4 | 5) => void;
  buyWeaponOrItem: (weaponId: WeaponId | 'armor') => boolean;
  triggerReload: () => void;
  triggerJump: () => void;
  toggleCrouch: () => void;
  toggleAim: () => void;
  setFiring: (firing: boolean) => void;
  triggerPlantOrDefuse: () => void;
  setTouchMoveVector: (vx: number, vz: number) => void;
  addTouchLookDelta: (dx: number, dy: number) => void;
  resetMatch: () => void;
}

interface TacticalArena3DProps {
  gameState: GameShellState;
  mapId: MapId;
  gameMode: GameModeId;
  playerTeam: BotTeam;
  botCount: number;
  botDifficulty: BotDifficulty;
  graphics: GraphicsSettings;
  equippedSkins: Record<string, string>;
  onHudUpdate: (hud: HudSnapshot) => void;
  onPauseRequest: () => void;
  onToggleBuyMenu: () => void;
  onScoreboardHold: (held: boolean) => void;
  onMatchFinished: (summary: {
    wonMatch: boolean;
    winnerTeam: BotTeam;
    vanguardScore: number;
    phantomScore: number;
    kills: number;
    deaths: number;
    headshots: number;
    bombObjectives: number;
    durationSeconds: number;
  }) => void;
  controlBridgeRef: React.MutableRefObject<ExternalControlBridge | null>;
  onNetworkStateEmit?: (state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weaponId: WeaponId;
  }) => void;
  remotePlayers?: {
    uid: string;
    username: string;
    team: BotTeam;
    x: number;
    y: number;
    z: number;
    yaw: number;
  }[];
}

interface ActiveGrenade {
  kind: 'grenade' | 'smoke' | 'flashbang';
  team: BotTeam;
  ownerName: string;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuseTimer: number;
}

interface ActiveSmokeCloud {
  x: number;
  z: number;
  radius: number;
  timer: number;
  group: THREE.Group;
}

export const TacticalArena3D: React.FC<TacticalArena3DProps> = (props) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && propsRef.current.graphics.preset !== 'Low',
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const initialW = container.clientWidth || window.innerWidth || 1280;
    const initialH = container.clientHeight || window.innerHeight || 720;
    renderer.setSize(initialW, initialH);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, propsRef.current.graphics.preset === 'Ultra' ? 2 : 1.5)
    );
    renderer.shadowMap.enabled = !isSoftwareGl && propsRef.current.graphics.preset !== 'Low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    renderer.domElement.setAttribute('data-testid', 'tactical-webgl-canvas');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      propsRef.current.graphics.fov || 75,
      initialW / initialH,
      0.1,
      260
    );
    scene.add(camera);

    // Lighting Rig: Warm Directional Key Light + Cool Hemisphere Fill
    const sunLight = new THREE.DirectionalLight(0xfff0d4, 2.5);
    sunLight.position.set(32, 52, 28);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 140;
      const d = 52;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xffe4b5, 0x334155, 0.95);
    scene.add(hemiLight);

    // Muzzle flash point light attached to camera
    const muzzleLight = new THREE.PointLight(0xffaa33, 0, 8);
    muzzleLight.position.set(0.25, -0.15, -0.9);
    camera.add(muzzleLight);

    // Zero-GC Pooled Particle System (InstancedMesh of 96 particles for bullet sparks, blood, & explosions)
    const PARTICLE_COUNT = 96;
    const particleGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleMesh = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_COUNT);
    particleMesh.frustumCulled = false;
    scene.add(particleMesh);

    const particlePool = Array.from({ length: PARTICLE_COUNT }, () => ({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.3,
      scale: 1,
      colorHex: 0xffaa00,
    }));
    let particleWriteIdx = 0;
    const dummyMatrix = new THREE.Matrix4();
    const dummyPos = new THREE.Vector3();
    const dummyQuat = new THREE.Quaternion();
    const dummyScale = new THREE.Vector3();
    const dummyColor = new THREE.Color();

    function spawnParticles(
      x: number,
      y: number,
      z: number,
      count: number,
      colorHex: number,
      speed = 5,
      scale = 1
    ) {
      for (let i = 0; i < count; i++) {
        const p = particlePool[particleWriteIdx];
        particleWriteIdx = (particleWriteIdx + 1) % PARTICLE_COUNT;
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const spd = (0.4 + Math.random() * 0.8) * speed;
        p.vx = Math.sin(phi) * Math.cos(theta) * spd;
        p.vy = Math.abs(Math.cos(phi)) * spd + 1.5;
        p.vz = Math.sin(phi) * Math.sin(theta) * spd;
        p.life = 0.18 + Math.random() * 0.25;
        p.maxLife = p.life;
        p.scale = scale;
        p.colorHex = colorHex;
      }
    }

    // Planted C4 3D Beacon Mesh
    const c4Group = new THREE.Group();
    const c4Body = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 })
    );
    c4Body.position.y = 0.09;
    c4Group.add(c4Body);
    const c4Led = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    c4Led.position.set(0, 0.2, 0);
    c4Group.add(c4Led);
    c4Group.visible = false;
    scene.add(c4Group);

    // Mutable Simulation State
    let currentMapId: MapId = propsRef.current.mapId;
    let mapGroup: THREE.Group | null = null;
    let collisionBoxes = buildMapCollisionBoxes(MAPS[currentMapId]);
    let weaponViewGroup: THREE.Group | null = null;
    let displayedWeaponId: WeaponId = 'ak47';
    let displayedSkinsKey = '';

    // Player physical state
    const player = {
      x: 0,
      y: 0,
      z: 36,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      grounded: true,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      crouching: false,
      aiming: false,
      firingHeld: false,
      health: 100,
      armor: 100,
      alive: true,
      respawnTimer: 0,
      cash: 4500,
      primaryWeapon: 'ak47' as WeaponId,
      secondaryWeapon: 'deagle' as WeaponId,
      activeWeapon: 'ak47' as WeaponId,
      ammoByWeapon: {
        ak47: { mag: 30, reserve: 90 },
        m4a1: { mag: 30, reserve: 90 },
        awp: { mag: 5, reserve: 30 },
        mp5: { mag: 30, reserve: 120 },
        shotgun: { mag: 8, reserve: 32 },
        deagle: { mag: 7, reserve: 35 },
        glock: { mag: 20, reserve: 100 },
        usp: { mag: 12, reserve: 48 },
        knife: { mag: 1, reserve: 0 },
        grenade: { mag: 1, reserve: 2 },
        smoke: { mag: 1, reserve: 1 },
        flashbang: { mag: 1, reserve: 2 },
      } as Record<WeaponId, { mag: number; reserve: number }>,
      reloadTimer: 0,
      fireCooldown: 0,
      recoilKickPitch: 0,
      recoilKickZ: 0,
      walkDistance: 0,
      footstepAccum: 0,
      kills: 0,
      deaths: 0,
      headshots: 0,
      bombObjectives: 0,
      flashAlpha: 0,
      damageIndicatorAlpha: 0,
      hitMarkerTimer: 0,
      hitMarkerType: 'none' as 'none' | 'hit' | 'headshot' | 'kill',
      cameraTrauma: 0,
    };

    let matchState = {
      vanguardScore: 0,
      phantomScore: 0,
      timeRemainingSec: 480,
      elapsedSec: 0,
      hitstopTimer: 0,
      bombState: 'none' as 'none' | 'planted' | 'defused' | 'exploded',
      bombCountdownSec: 40,
      bombBeepTimer: 1,
      plantedPos: null as { x: number; z: number } | null,
      actionProgress: 0,
      killFeed: [] as KillFeedEntry[],
      matchEnded: false,
    };

    let bots: BotActor[] = [];
    const botMeshes = new Map<string, OperatorMeshRig>();
    const remotePlayerMeshes = new Map<string, OperatorMeshRig>();
    const activeGrenades: ActiveGrenade[] = [];
    const activeSmokes: ActiveSmokeCloud[] = [];

    function rebuildWeaponViewmodel() {
      if (weaponViewGroup) {
        camera.remove(weaponViewGroup);
      }
      weaponViewGroup = buildFirstPersonWeaponModel(
        player.activeWeapon,
        propsRef.current.equippedSkins
      );
      camera.add(weaponViewGroup);
      displayedWeaponId = player.activeWeapon;
      displayedSkinsKey = JSON.stringify(propsRef.current.equippedSkins);
    }

    function loadMapAndResetMatch() {
      currentMapId = propsRef.current.mapId;
      const mapCfg = MAPS[currentMapId];
      const modeCfg = GAME_MODES[propsRef.current.gameMode];

      scene.background = new THREE.Color(mapCfg.skyColorHex);
      scene.fog = new THREE.FogExp2(mapCfg.fogColorHex, mapCfg.fogDensity);
      sunLight.color.setHex(mapCfg.sunColorHex);
      sunLight.intensity = mapCfg.sunIntensity;
      hemiLight.color.setHex(mapCfg.hemiSkyHex);
      hemiLight.groundColor.setHex(mapCfg.hemiGroundHex);

      if (mapGroup) {
        scene.remove(mapGroup);
      }
      mapGroup = buildTacticalMapGroup(mapCfg, renderer, renderer.shadowMap.enabled);
      scene.add(mapGroup);
      collisionBoxes = buildMapCollisionBoxes(mapCfg);

      // Clear old bot meshes
      for (const rig of botMeshes.values()) {
        scene.remove(rig.group);
      }
      botMeshes.clear();

      // Clear active grenades and smokes
      for (const g of activeGrenades) scene.remove(g.mesh);
      activeGrenades.length = 0;
      for (const s of activeSmokes) scene.remove(s.group);
      activeSmokes.length = 0;

      // Spawn Player on an open lane facing clear vista
      const teamSpawns =
        propsRef.current.playerTeam === 'vanguard'
          ? mapCfg.vanguardSpawns
          : mapCfg.phantomSpawns;
      const sp = teamSpawns[0];
      player.x = sp.x;
      player.y = 0;
      player.z = sp.z;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
      player.yaw = sp.yaw;
      player.pitch = 0;
      player.health = 100;
      player.armor = 100;
      player.alive = true;
      player.cash = modeCfg.startingCash;
      player.primaryWeapon = propsRef.current.playerTeam === 'vanguard' ? 'm4a1' : 'ak47';
      player.secondaryWeapon = propsRef.current.playerTeam === 'vanguard' ? 'usp' : 'glock';
      player.activeWeapon = player.primaryWeapon;
      player.reloadTimer = 0;
      player.fireCooldown = 0;
      player.kills = 0;
      player.deaths = 0;
      player.headshots = 0;
      player.bombObjectives = 0;
      player.flashAlpha = 0;
      player.damageIndicatorAlpha = 0;

      for (const wKey of Object.keys(WEAPONS) as WeaponId[]) {
        player.ammoByWeapon[wKey] = {
          mag: WEAPONS[wKey].magCapacity,
          reserve: WEAPONS[wKey].reserveCapacity,
        };
      }

      matchState = {
        vanguardScore: 0,
        phantomScore: 0,
        timeRemainingSec: modeCfg.matchDurationSec,
        elapsedSec: 0,
        hitstopTimer: 0,
        bombState: 'none',
        bombCountdownSec: 40,
        bombBeepTimer: 1,
        plantedPos: null,
        actionProgress: 0,
        killFeed: [],
        matchEnded: false,
      };
      c4Group.visible = false;

      // Spawn Smart Bots
      bots = createBotRoster(
        propsRef.current.botCount,
        propsRef.current.botDifficulty,
        mapCfg,
        propsRef.current.playerTeam
      );
      for (const bot of bots) {
        const rig = createOperatorCharacterMesh(bot.team);
        rig.group.position.set(bot.x, bot.y, bot.z);
        rig.group.rotation.y = bot.yaw;
        scene.add(rig.group);
        botMeshes.set(bot.id, rig);
      }

      rebuildWeaponViewmodel();
    }

    loadMapAndResetMatch();
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    function pushKillFeed(killer: string, victim: string, weaponId: WeaponId, headshot: boolean, team: BotTeam) {
      matchState.killFeed = [
        {
          id: `${Date.now()}-${Math.random()}`,
          killer,
          victim,
          weaponId,
          headshot,
          team,
        },
        ...matchState.killFeed.slice(0, 4),
      ];
    }

    function launchGrenadeProjectile(
      kind: 'grenade' | 'smoke' | 'flashbang',
      team: BotTeam,
      ownerName: string,
      ox: number,
      oy: number,
      oz: number,
      dx: number,
      dy: number,
      dz: number
    ) {
      const color = kind === 'grenade' ? 0x15803d : kind === 'smoke' ? 0x64748b : 0xfacc15;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 10),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 })
      );
      mesh.position.set(ox, oy, oz);
      scene.add(mesh);

      const speed = 19;
      activeGrenades.push({
        kind,
        team,
        ownerName,
        mesh,
        x: ox,
        y: oy,
        z: oz,
        vx: dx * speed,
        vy: dy * speed + 4.2,
        vz: dz * speed,
        fuseTimer: 1.75,
      });
    }

    function executePlayerFire() {
      if (!player.alive || player.reloadTimer > 0 || player.fireCooldown > 0) return;

      const wSpec = WEAPONS[player.activeWeapon];
      const ammoState = player.ammoByWeapon[player.activeWeapon];

      // Handle Grenade / Smoke / Flashbang throw
      if (wSpec.category === 'grenade') {
        if (ammoState.mag <= 0 && ammoState.reserve <= 0) return;
        if (ammoState.mag > 0) ammoState.mag--;
        else ammoState.reserve--;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
        launchGrenadeProjectile(
          player.activeWeapon as 'grenade' | 'smoke' | 'flashbang',
          propsRef.current.playerTeam,
          'YOU',
          player.x + forward.x * 0.6,
          player.y + 1.45,
          player.z + forward.z * 0.6,
          forward.x,
          forward.y,
          forward.z
        );
        player.fireCooldown = 0.85;
        player.recoilKickZ = 0.12;
        if (ammoState.mag === 0 && ammoState.reserve > 0) {
          ammoState.mag = 1;
          ammoState.reserve--;
        }
        return;
      }

      if (wSpec.category !== 'melee' && ammoState.mag <= 0) {
        triggerReload();
        return;
      }

      if (wSpec.category !== 'melee') {
        ammoState.mag--;
      }

      player.fireCooldown = 60 / wSpec.fireRateRPM;
      soundEngine.playWeaponFire(player.activeWeapon, 0);

      // Alert nearby bots to gunshot sound
      if (player.activeWeapon !== 'usp' && player.activeWeapon !== 'knife') {
        broadcastSoundAlertToBots(
          bots,
          propsRef.current.playerTeam,
          propsRef.current.gameMode === 'dm',
          player.x,
          player.z,
          46
        );
      }

      // Muzzle flash & physical recoil kick
      if (wSpec.category !== 'melee') {
        muzzleLight.intensity = 5.5;
      }
      player.recoilKickPitch += wSpec.recoilVertical * (player.aiming ? 0.55 : 1.0);
      player.recoilKickZ = 0.085;
      player.cameraTrauma = Math.min(1, player.cameraTrauma + (player.activeWeapon === 'awp' ? 0.45 : 0.16));

      const pelletCount = wSpec.pellets || 1;
      const moveSpeed = Math.hypot(player.vx, player.vz);
      const spreadAmount =
        (1 - wSpec.accuracy) * (player.aiming ? 0.25 : 0.7) +
        (moveSpeed > 1.2 ? wSpec.movementInaccuracy : 0);

      const eyeX = player.x;
      const eyeY = player.y + (player.crouching ? 1.05 : 1.62);
      const eyeZ = player.z;
      const baseForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

      for (let p = 0; p < pelletCount; p++) {
        const dir = baseForward.clone();
        if (spreadAmount > 0.001) {
          dir.x += (Math.random() - 0.5) * spreadAmount;
          dir.y += (Math.random() - 0.5) * spreadAmount;
          dir.z += (Math.random() - 0.5) * spreadAmount;
          dir.normalize();
        }

        // 1. Find closest environment wall hit
        let wallDist = wSpec.range;
        for (let i = 0; i < collisionBoxes.length; i++) {
          const t = intersectRayAABB(
            eyeX,
            eyeY,
            eyeZ,
            dir.x,
            dir.y,
            dir.z,
            collisionBoxes[i],
            wallDist
          );
          if (t !== null && t < wallDist) {
            wallDist = t;
          }
        }

        // 2. Check Bot Head & Body Hitboxes closer than wallDist
        let hitBot: BotActor | null = null;
        let hitDist = wallDist;
        let hitHeadshot = false;

        for (const bot of bots) {
          if (!bot.alive) continue;
          if (propsRef.current.gameMode !== 'dm' && bot.team === propsRef.current.playerTeam) {
            continue;
          }

          const headBox = {
            minX: bot.x - 0.26,
            maxX: bot.x + 0.26,
            minY: bot.y + 1.4,
            maxY: bot.y + 1.88,
            minZ: bot.z - 0.26,
            maxZ: bot.z + 0.26,
          };
          const bodyBox = {
            minX: bot.x - 0.42,
            maxX: bot.x + 0.42,
            minY: bot.y + 0.1,
            maxY: bot.y + 1.42,
            minZ: bot.z - 0.42,
            maxZ: bot.z + 0.42,
          };

          const tHead = intersectRayAABB(eyeX, eyeY, eyeZ, dir.x, dir.y, dir.z, headBox, hitDist);
          if (tHead !== null && tHead < hitDist) {
            hitDist = tHead;
            hitBot = bot;
            hitHeadshot = true;
            continue;
          }

          const tBody = intersectRayAABB(eyeX, eyeY, eyeZ, dir.x, dir.y, dir.z, bodyBox, hitDist);
          if (tBody !== null && tBody < hitDist) {
            hitDist = tBody;
            hitBot = bot;
            hitHeadshot = false;
          }
        }

        const impactX = eyeX + dir.x * hitDist;
        const impactY = eyeY + dir.y * hitDist;
        const impactZ = eyeZ + dir.z * hitDist;

        if (hitBot) {
          const dmg = computeWeaponDamage({
            weaponId: player.activeWeapon,
            distanceMeters: hitDist,
            isHeadshot: hitHeadshot,
            targetHealth: hitBot.health,
            targetArmor: hitBot.armor,
          });

          hitBot.health = dmg.nextHealth;
          hitBot.armor = dmg.nextArmor;
          hitBot.hitFlashTimer = 0.08;
          hitBot.alertLocation = { x: player.x, z: player.z };

          if (propsRef.current.graphics.bloodEnabled) {
            spawnParticles(impactX, impactY, impactZ, hitHeadshot ? 14 : 8, 0xdc2626, 6, 1.15);
          } else {
            spawnParticles(impactX, impactY, impactZ, 8, 0xfbbf24, 6, 1.0);
          }

          soundEngine.playHitMarker(hitHeadshot);
          player.hitMarkerTimer = 0.18;
          player.hitMarkerType = dmg.isLethal ? 'kill' : hitHeadshot ? 'headshot' : 'hit';

          if (dmg.isLethal) {
            hitBot.alive = false;
            hitBot.deaths++;
            hitBot.respawnTimer = GAME_MODES[propsRef.current.gameMode].respawnDelaySec;
            player.kills++;
            if (hitHeadshot) player.headshots++;
            player.cash = Math.min(16000, player.cash + 300);
            matchState.hitstopTimer = 0.04;

            if (propsRef.current.playerTeam === 'vanguard') {
              matchState.vanguardScore++;
            } else {
              matchState.phantomScore++;
            }

            pushKillFeed('YOU', hitBot.name, player.activeWeapon, hitHeadshot, propsRef.current.playerTeam);
          }
        } else if (hitDist < wSpec.range) {
          // Bullet spark on wall/crate
          spawnParticles(impactX, impactY, impactZ, 5, 0xfacc15, 4.5, 0.8);
        }
      }

      if (ammoState.mag === 0 && ammoState.reserve > 0 && wSpec.category !== 'melee') {
        triggerReload();
      }
    }

    function triggerReload() {
      const wSpec = WEAPONS[player.activeWeapon];
      const ammo = player.ammoByWeapon[player.activeWeapon];
      if (
        player.reloadTimer > 0 ||
        wSpec.category === 'melee' ||
        wSpec.category === 'grenade' ||
        ammo.mag >= wSpec.magCapacity ||
        ammo.reserve <= 0
      ) {
        return;
      }
      player.reloadTimer = wSpec.reloadTime;
      player.aiming = false;
      soundEngine.playReload();
    }

    function switchWeaponSlot(slot: 1 | 2 | 3 | 4 | 5) {
      let nextWeapon: WeaponId = player.activeWeapon;
      if (slot === 1) nextWeapon = player.primaryWeapon;
      else if (slot === 2) nextWeapon = player.secondaryWeapon;
      else if (slot === 3) nextWeapon = 'knife';
      else if (slot === 4) nextWeapon = 'grenade';
      else if (slot === 5) {
        nextWeapon = player.activeWeapon === 'smoke' ? 'flashbang' : 'smoke';
      }

      if (nextWeapon !== player.activeWeapon) {
        player.activeWeapon = nextWeapon;
        player.reloadTimer = 0;
        player.aiming = false;
        rebuildWeaponViewmodel();
      }
    }

    function buyWeaponOrItem(item: WeaponId | 'armor'): boolean {
      if (item === 'armor') {
        if (player.cash < 650 || player.armor >= 100) return false;
        player.cash -= 650;
        player.armor = 100;
        return true;
      }
      const spec = WEAPONS[item];
      if (!spec || player.cash < spec.price) return false;
      player.cash -= spec.price;
      player.ammoByWeapon[item] = {
        mag: spec.magCapacity,
        reserve: spec.reserveCapacity,
      };
      if (spec.slot === 1) player.primaryWeapon = item;
      else if (spec.slot === 2) player.secondaryWeapon = item;
      player.activeWeapon = item;
      player.reloadTimer = 0;
      rebuildWeaponViewmodel();
      return true;
    }

    // Touch & External Control Bridge
    const touchMoveVec = { vx: 0, vz: 0 };

    propsRef.current.controlBridgeRef.current = {
      switchWeaponSlot,
      buyWeaponOrItem,
      triggerReload,
      triggerJump: () => {
        player.jumpBufferTimer = 0.14;
      },
      toggleCrouch: () => {
        player.crouching = !player.crouching;
      },
      toggleAim: () => {
        player.aiming = !player.aiming;
      },
      setFiring: (firing: boolean) => {
        player.firingHeld = firing;
        if (firing) executePlayerFire();
      },
      triggerPlantOrDefuse: () => {
        handleBombActionStep(0.35);
      },
      setTouchMoveVector: (vx: number, vz: number) => {
        touchMoveVec.vx = vx;
        touchMoveVec.vz = vz;
      },
      addTouchLookDelta: (dx: number, dy: number) => {
        const sens = 0.0032 * (propsRef.current.graphics.sensitivity || 1);
        player.yaw -= dx * sens;
        player.pitch = Math.max(-1.42, Math.min(1.42, player.pitch - dy * sens));
      },
      resetMatch: () => {
        loadMapAndResetMatch();
      },
    };

    // Keyboard & Mouse Input Listeners
    const keysHeld = new Set<string>();
    let isPointerDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.tagName === 'SELECT')
      ) {
        return;
      }

      const code = e.code;
      if (propsRef.current.gameState !== 'playing') return;

      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        document.exitPointerLock?.();
        propsRef.current.onPauseRequest();
        return;
      }
      if (code === 'Tab') {
        e.preventDefault();
        propsRef.current.onScoreboardHold(true);
        return;
      }
      if (code === 'KeyB') {
        e.preventDefault();
        propsRef.current.onToggleBuyMenu();
        return;
      }

      if (!keysHeld.has(code)) {
        // Edge-triggered actions
        if (code === 'Space') {
          e.preventDefault();
          player.jumpBufferTimer = 0.12;
        } else if (code === 'KeyR') {
          triggerReload();
        } else if (code === 'Digit1') {
          switchWeaponSlot(1);
        } else if (code === 'Digit2') {
          switchWeaponSlot(2);
        } else if (code === 'Digit3') {
          switchWeaponSlot(3);
        } else if (code === 'Digit4') {
          switchWeaponSlot(4);
        } else if (code === 'Digit5') {
          switchWeaponSlot(5);
        } else if (code === 'KeyG') {
          switchWeaponSlot(4);
          executePlayerFire();
        } else if (code === 'KeyF') {
          executePlayerFire();
        } else if (code === 'KeyC') {
          player.crouching = !player.crouching;
        }
      }

      keysHeld.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      keysHeld.delete(code);
      if (code === 'Tab') {
        propsRef.current.onScoreboardHold(false);
      }
      // Variable jump height cut when releasing Space while ascending
      if (code === 'Space' && player.vy > 0) {
        player.vy *= 0.45;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (propsRef.current.gameState !== 'playing') return;
      if (e.target !== renderer.domElement) return;

      if (e.button === 0) {
        isPointerDragging = true;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        player.firingHeld = true;
        executePlayerFire();
      } else if (e.button === 2) {
        e.preventDefault();
        player.aiming = !player.aiming;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isPointerDragging = false;
        player.firingHeld = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (propsRef.current.gameState !== 'playing') return;
      const sens = 0.0024 * (propsRef.current.graphics.sensitivity || 1);

      if (document.pointerLockElement === renderer.domElement) {
        player.yaw -= e.movementX * sens;
        player.pitch = Math.max(-1.42, Math.min(1.42, player.pitch - e.movementY * sens));
      } else if (isPointerDragging) {
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        player.yaw -= dx * sens * 1.4;
        player.pitch = Math.max(-1.42, Math.min(1.42, player.pitch - dy * sens * 1.4));
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (e.target === renderer.domElement) {
        e.preventDefault();
      }
    };

    const handleBlurOrVisibility = () => {
      keysHeld.clear();
      player.firingHeld = false;
      isPointerDragging = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('blur', handleBlurOrVisibility);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(320, entry.contentRect.width);
        const h = Math.max(240, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    function getNearBombSite(): 'A' | 'B' | null {
      const mapCfg = MAPS[currentMapId];
      const dA = Math.hypot(player.x - mapCfg.bombSiteA.x, player.z - mapCfg.bombSiteA.z);
      if (dA <= mapCfg.bombSiteA.radius) return 'A';
      const dB = Math.hypot(player.x - mapCfg.bombSiteB.x, player.z - mapCfg.bombSiteB.z);
      if (dB <= mapCfg.bombSiteB.radius) return 'B';
      return null;
    }

    function handleBombActionStep(dt: number) {
      const nearSite = getNearBombSite();
      if (!nearSite) {
        matchState.actionProgress = 0;
        return;
      }

      if (matchState.bombState === 'none') {
        matchState.actionProgress = Math.min(1, matchState.actionProgress + dt * 0.45);
        if (matchState.actionProgress >= 1) {
          matchState.bombState = 'planted';
          matchState.bombCountdownSec = 40;
          matchState.plantedPos = { x: player.x, z: player.z };
          matchState.actionProgress = 0;
          c4Group.position.set(player.x, 0.02, player.z);
          c4Group.visible = true;
          player.bombObjectives++;
          player.cash = Math.min(16000, player.cash + 800);
          soundEngine.playBombBeep(true);
        }
      } else if (matchState.bombState === 'planted') {
        matchState.actionProgress = Math.min(1, matchState.actionProgress + dt * 0.35);
        if (matchState.actionProgress >= 1) {
          matchState.bombState = 'defused';
          matchState.actionProgress = 0;
          c4Group.visible = false;
          matchState.vanguardScore += 3;
          player.bombObjectives++;
          player.cash = Math.min(16000, player.cash + 1000);
        }
      }
    }

    // Main Animation Loop (with software-WebGL fence sync pacing)
    let frameId = 0;
    let lastTime = performance.now();
    let hudEmitAccum = 0;
    let netEmitAccum = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (!sync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      // Check if map or equipped skins changed
      if (propsRef.current.mapId !== currentMapId) {
        loadMapAndResetMatch();
      }
      const skinsKey = JSON.stringify(propsRef.current.equippedSkins);
      if (player.activeWeapon !== displayedWeaponId || skinsKey !== displayedSkinsKey) {
        rebuildWeaponViewmodel();
      }

      soundEngine.setVolume(propsRef.current.graphics.volume);

      const state = propsRef.current.gameState;

      if (state === 'title') {
        // Live World Camera Tour / Parallax Pan over the active 3D arena
        matchState.elapsedSec += dt;
        const tourAngle = matchState.elapsedSec * 0.18;
        const radius = 29;
        camera.position.set(
          Math.sin(tourAngle) * radius,
          10.5 + Math.sin(matchState.elapsedSec * 0.4) * 1.5,
          Math.cos(tourAngle) * radius
        );
        camera.lookAt(0, 2.5, 0);
        if (weaponViewGroup) weaponViewGroup.visible = false;
      } else if (state === 'playing') {
        if (weaponViewGroup) weaponViewGroup.visible = true;

        // Hitstop decay
        if (matchState.hitstopTimer > 0) {
          matchState.hitstopTimer = Math.max(0, matchState.hitstopTimer - dt);
        }
        const simDt = matchState.hitstopTimer > 0 ? dt * 0.15 : dt;

        matchState.elapsedSec += simDt;
        matchState.timeRemainingSec = Math.max(0, matchState.timeRemainingSec - simDt);

        // Bomb countdown logic
        if (matchState.bombState === 'planted') {
          matchState.bombCountdownSec -= simDt;
          matchState.bombBeepTimer -= simDt;
          const beepInterval = matchState.bombCountdownSec < 10 ? 0.25 : 0.85;
          if (matchState.bombBeepTimer <= 0) {
            matchState.bombBeepTimer = beepInterval;
            soundEngine.playBombBeep(matchState.bombCountdownSec < 10);
          }
          if (matchState.bombCountdownSec <= 0) {
            matchState.bombState = 'exploded';
            c4Group.visible = false;
            soundEngine.playExplosion();
            if (matchState.plantedPos) {
              spawnParticles(matchState.plantedPos.x, 1.2, matchState.plantedPos.z, 36, 0xf97316, 14, 2.4);
            }
            matchState.phantomScore += 3;
          }
        }

        // Check Win / Match End condition
        const targetScore = GAME_MODES[propsRef.current.gameMode].targetScore;
        if (
          !matchState.matchEnded &&
          (matchState.vanguardScore >= targetScore ||
            matchState.phantomScore >= targetScore ||
            matchState.timeRemainingSec <= 0)
        ) {
          matchState.matchEnded = true;
          const winnerTeam: BotTeam =
            matchState.vanguardScore >= matchState.phantomScore ? 'vanguard' : 'phantom';
          const wonMatch = winnerTeam === propsRef.current.playerTeam;
          document.exitPointerLock?.();
          propsRef.current.onMatchFinished({
            wonMatch,
            winnerTeam,
            vanguardScore: matchState.vanguardScore,
            phantomScore: matchState.phantomScore,
            kills: player.kills,
            deaths: player.deaths,
            headshots: player.headshots,
            bombObjectives: player.bombObjectives,
            durationSeconds: Math.round(matchState.elapsedSec),
          });
        }

        // Player Respawn or Movement
        if (!player.alive) {
          player.respawnTimer -= simDt;
          if (player.respawnTimer <= 0) {
            const spawns =
              propsRef.current.playerTeam === 'vanguard'
                ? MAPS[currentMapId].vanguardSpawns
                : MAPS[currentMapId].phantomSpawns;
            const sp = spawns[Math.floor(Math.random() * spawns.length)];
            player.x = sp.x;
            player.y = 0;
            player.z = sp.z;
            player.yaw = sp.yaw;
            player.pitch = 0;
            player.health = 100;
            player.armor = 100;
            player.alive = true;
          }
        } else {
          // Reload timer
          if (player.reloadTimer > 0) {
            player.reloadTimer -= simDt;
            if (player.reloadTimer <= 0) {
              const wSpec = WEAPONS[player.activeWeapon];
              const ammo = player.ammoByWeapon[player.activeWeapon];
              const needed = wSpec.magCapacity - ammo.mag;
              const take = Math.min(needed, ammo.reserve);
              ammo.mag += take;
              ammo.reserve -= take;
            }
          }

          if (player.fireCooldown > 0) {
            player.fireCooldown = Math.max(0, player.fireCooldown - simDt);
          }

          // Automatic weapon continuous fire
          if (player.firingHeld && WEAPONS[player.activeWeapon].isAutomatic) {
            executePlayerFire();
          }

          // Bomb plant / defuse hold [E]
          if (keysHeld.has('KeyE')) {
            handleBombActionStep(simDt);
          } else if (matchState.actionProgress > 0) {
            matchState.actionProgress = Math.max(0, matchState.actionProgress - simDt * 1.5);
          }

          // WASD + Arrow + Touch Joystick Movement
          let forwardInput = 0;
          let rightInput = 0;
          if (keysHeld.has('KeyW') || keysHeld.has('ArrowUp')) forwardInput += 1;
          if (keysHeld.has('KeyS') || keysHeld.has('ArrowDown')) forwardInput -= 1;
          if (keysHeld.has('KeyD') || keysHeld.has('ArrowRight')) rightInput += 1;
          if (keysHeld.has('KeyA') || keysHeld.has('ArrowLeft')) rightInput -= 1;

          forwardInput += touchMoveVec.vz;
          rightInput += touchMoveVec.vx;

          const crouchHeld =
            keysHeld.has('ControlLeft') || keysHeld.has('ControlRight') || player.crouching;
          const sprintHeld =
            (keysHeld.has('ShiftLeft') || keysHeld.has('ShiftRight')) && !crouchHeld && !player.aiming;

          const baseSpeed = crouchHeld ? 4.2 : sprintHeld ? 9.4 : 7.0;
          const moveSpeed = baseSpeed * WEAPONS[player.activeWeapon].moveSpeedMultiplier;

          const inputLen = Math.hypot(forwardInput, rightInput);
          if (inputLen > 0.01) {
            const nf = forwardInput / Math.max(1, inputLen);
            const nr = rightInput / Math.max(1, inputLen);
            const sinY = Math.sin(player.yaw);
            const cosY = Math.cos(player.yaw);

            // Forward in Three.js camera with rotation.y = yaw is (-sin(yaw), 0, -cos(yaw))
            const moveX = -sinY * nf + cosY * nr;
            const moveZ = -cosY * nf - sinY * nr;

            player.vx = moveX * moveSpeed;
            player.vz = moveZ * moveSpeed;
          } else {
            player.vx *= Math.exp(-14 * simDt);
            player.vz *= Math.exp(-14 * simDt);
          }

          // Coyote time & Jump buffer
          if (player.grounded) {
            player.coyoteTimer = 0.1;
          } else {
            player.coyoteTimer = Math.max(0, player.coyoteTimer - simDt);
          }

          if (player.jumpBufferTimer > 0) {
            player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - simDt);
            if (player.coyoteTimer > 0) {
              player.vy = 6.8;
              player.grounded = false;
              player.coyoteTimer = 0;
              player.jumpBufferTimer = 0;
              soundEngine.playFootstep(0);
            }
          }

          // Gravity
          player.vy -= 18.5 * simDt;
          player.y += player.vy * simDt;
          if (player.y <= 0) {
            if (!player.grounded && player.vy < -3) {
              soundEngine.playFootstep(0);
            }
            player.y = 0;
            player.vy = 0;
            player.grounded = true;
          }

          // Horizontal displacement + AABB collision
          const nextX = player.x + player.vx * simDt;
          const nextZ = player.z + player.vz * simDt;
          const resolved = resolveHorizontalCollision(nextX, player.y, nextZ, 0.55, collisionBoxes);
          const distStep = Math.hypot(resolved.x - player.x, resolved.z - player.z);
          player.x = resolved.x;
          player.z = resolved.z;

          if (player.grounded && distStep > 0.001) {
            player.walkDistance += distStep;
            player.footstepAccum += distStep;
            if (player.footstepAccum >= 2.6) {
              player.footstepAccum = 0;
              soundEngine.playFootstep(0);
            }
          }
        }

        // Step Grenade Projectiles
        for (let i = activeGrenades.length - 1; i >= 0; i--) {
          const g = activeGrenades[i];
          g.fuseTimer -= simDt;
          g.vy -= 16 * simDt;
          const nx = g.x + g.vx * simDt;
          let ny = g.y + g.vy * simDt;
          const nz = g.z + g.vz * simDt;

          if (ny <= 0.12) {
            ny = 0.12;
            g.vy = -g.vy * 0.42;
            g.vx *= 0.65;
            g.vz *= 0.65;
          }
          const col = resolveHorizontalCollision(nx, ny, nz, 0.18, collisionBoxes, 0.25);
          if (col.collided) {
            g.vx *= -0.45;
            g.vz *= -0.45;
          }
          g.x = col.x;
          g.y = ny;
          g.z = col.z;
          g.mesh.position.set(g.x, g.y, g.z);
          g.mesh.rotation.x += 6 * simDt;

          if (g.fuseTimer <= 0) {
            scene.remove(g.mesh);
            activeGrenades.splice(i, 1);

            if (g.kind === 'grenade') {
              soundEngine.playExplosion();
              spawnParticles(g.x, g.y + 0.3, g.z, 28, 0xf97316, 11, 2.0);
              // Blast damage to bots and player within 9.5m
              for (const bot of bots) {
                if (!bot.alive) continue;
                const d = Math.hypot(bot.x - g.x, bot.z - g.z);
                if (d < 9.5) {
                  const dmg = Math.round((1 - d / 9.5) * 96);
                  bot.health = Math.max(0, bot.health - dmg);
                  if (bot.health === 0) {
                    bot.alive = false;
                    bot.deaths++;
                    bot.respawnTimer = 3;
                    if (g.ownerName === 'YOU') player.kills++;
                    pushKillFeed(g.ownerName, bot.name, 'grenade', false, g.team);
                  }
                }
              }
            } else if (g.kind === 'smoke') {
              const smokeGroup = new THREE.Group();
              smokeGroup.position.set(g.x, 0, g.z);
              const puffMat = new THREE.MeshStandardMaterial({
                color: 0xcbd5e1,
                roughness: 0.95,
                metalness: 0.0,
                transparent: true,
                opacity: 0.78,
                depthWrite: false,
              });
              const offsets = [
                [0, 1.8, 0, 2.6],
                [-1.8, 1.4, 1.2, 2.1],
                [1.8, 1.5, -1.1, 2.2],
                [0.9, 2.2, 1.6, 2.0],
                [-1.2, 1.6, -1.5, 2.1],
              ];
              for (const [ox, oy, oz, rad] of offsets) {
                const puff = new THREE.Mesh(new THREE.SphereGeometry(rad, 12, 12), puffMat);
                puff.position.set(ox, oy, oz);
                smokeGroup.add(puff);
              }
              scene.add(smokeGroup);
              activeSmokes.push({ x: g.x, z: g.z, radius: 5.2, timer: 15, group: smokeGroup });
            } else if (g.kind === 'flashbang') {
              soundEngine.playExplosion();
              spawnParticles(g.x, g.y + 0.5, g.z, 18, 0xffffff, 9, 1.6);
              for (const bot of bots) {
                if (!bot.alive) continue;
                if (Math.hypot(bot.x - g.x, bot.z - g.z) < 18) {
                  bot.blindTimer = 4.2;
                }
              }
              if (Math.hypot(player.x - g.x, player.z - g.z) < 16) {
                player.flashAlpha = 0.85;
              }
            }
          }
        }

        // Step Active Volumetric Smoke Clouds
        for (let i = activeSmokes.length - 1; i >= 0; i--) {
          const s = activeSmokes[i];
          s.timer -= simDt;
          s.group.rotation.y += simDt * 0.25;
          if (s.timer <= 0) {
            scene.remove(s.group);
            activeSmokes.splice(i, 1);
          }
        }

        // Step Smart Bots AI
        if (propsRef.current.gameMode !== 'practice' || propsRef.current.botCount > 0) {
          stepBotsAI({
            dt: simDt,
            mapConfig: MAPS[currentMapId],
            collisionBoxes,
            smokeZones: activeSmokes,
            player: {
              id: 'player',
              team: propsRef.current.playerTeam,
              x: player.x,
              y: player.y,
              z: player.z,
              alive: player.alive,
            },
            allBots: bots,
            isFreeForAll: propsRef.current.gameMode === 'dm',
            bombPlantedAt: matchState.plantedPos,
            onBotFire: (bot, targetId, aimX, aimY, aimZ) => {
              const distToPlayer = Math.hypot(bot.x - player.x, bot.z - player.z);
              soundEngine.playWeaponFire(bot.activeWeapon, distToPlayer);
              spawnParticles(bot.x, 1.35, bot.z, 3, 0xffaa00, 3, 0.7);

              if (targetId === 'player' && player.alive) {
                const hitErr = Math.hypot(aimX - player.x, aimZ - player.z);
                if (hitErr < 0.95) {
                  const isHs = Math.abs(aimY - (player.y + 1.55)) < 0.22;
                  const dmg = computeWeaponDamage({
                    weaponId: bot.activeWeapon,
                    distanceMeters: distToPlayer,
                    isHeadshot: isHs,
                    targetHealth: player.health,
                    targetArmor: player.armor,
                  });
                  // Keep opening 5s approachable and scale bot damage slightly on Easy/Normal
                  const diffScale =
                    propsRef.current.botDifficulty === 'Easy'
                      ? 0.45
                      : propsRef.current.botDifficulty === 'Normal'
                      ? 0.65
                      : 0.85;
                  const appliedDmg = Math.max(2, Math.round(dmg.healthDamage * diffScale));
                  player.health = Math.max(0, player.health - appliedDmg);
                  player.armor = dmg.nextArmor;
                  player.damageIndicatorAlpha = 0.75;
                  player.cameraTrauma = Math.min(1, player.cameraTrauma + 0.32);

                  if (player.health <= 0) {
                    player.alive = false;
                    player.deaths++;
                    player.respawnTimer = GAME_MODES[propsRef.current.gameMode].respawnDelaySec;
                    bot.kills++;
                    if (bot.team === 'vanguard') matchState.vanguardScore++;
                    else matchState.phantomScore++;
                    pushKillFeed(bot.name, 'YOU', bot.activeWeapon, isHs, bot.team);
                  }
                }
              } else {
                const victimBot = bots.find((b) => b.id === targetId && b.alive);
                if (victimBot) {
                  const d = Math.hypot(bot.x - victimBot.x, bot.z - victimBot.z);
                  const dmg = computeWeaponDamage({
                    weaponId: bot.activeWeapon,
                    distanceMeters: d,
                    isHeadshot: Math.random() < 0.2,
                    targetHealth: victimBot.health,
                    targetArmor: victimBot.armor,
                  });
                  victimBot.health = dmg.nextHealth;
                  victimBot.armor = dmg.nextArmor;
                  victimBot.hitFlashTimer = 0.08;
                  if (dmg.isLethal) {
                    victimBot.alive = false;
                    victimBot.deaths++;
                    victimBot.respawnTimer = 3;
                    bot.kills++;
                    if (bot.team === 'vanguard') matchState.vanguardScore++;
                    else matchState.phantomScore++;
                    pushKillFeed(bot.name, victimBot.name, bot.activeWeapon, false, bot.team);
                  }
                }
              }
            },
            onBotThrowSmokeOrGrenade: (bot, targetX, targetZ, kind) => {
              const dx = targetX - bot.x;
              const dz = targetZ - bot.z;
              const len = Math.max(1, Math.hypot(dx, dz));
              launchGrenadeProjectile(
                kind,
                bot.team,
                bot.name,
                bot.x,
                1.4,
                bot.z,
                dx / len,
                0.15,
                dz / len
              );
            },
          });
        }

        // Update Bot 3D Articulated Meshes
        for (const bot of bots) {
          const rig = botMeshes.get(bot.id);
          if (!rig) continue;
          rig.group.position.set(bot.x, bot.y, bot.z);
          rig.group.rotation.y = bot.yaw;

          if (!bot.alive) {
            // Smooth KO topple animation
            rig.group.rotation.x = -bot.koToppleProgress * (Math.PI / 2);
            rig.group.position.y = bot.koToppleProgress * 0.2;
          } else {
            rig.group.rotation.x = 0;
            const swing = Math.sin(bot.walkPhase) * 0.45;
            rig.leftLeg.rotation.x = swing;
            rig.rightLeg.rotation.x = -swing;

            // Hit flash emissive feedback
            const torsoMat = rig.torso.material as THREE.MeshStandardMaterial;
            if (bot.hitFlashTimer > 0) {
              torsoMat.emissive.setHex(0xffffff);
              torsoMat.emissiveIntensity = 0.85;
            } else {
              torsoMat.emissive.setHex(0x000000);
              torsoMat.emissiveIntensity = 0;
            }
          }
        }

        // Update Remote Multiplayer Player Meshes
        const remotes = propsRef.current.remotePlayers || [];
        const seenRemoteUids = new Set<string>();
        for (const rp of remotes) {
          seenRemoteUids.add(rp.uid);
          let rig = remotePlayerMeshes.get(rp.uid);
          if (!rig) {
            rig = createOperatorCharacterMesh(rp.team);
            scene.add(rig.group);
            remotePlayerMeshes.set(rp.uid, rig);
          }
          rig.group.position.lerp(new THREE.Vector3(rp.x, rp.y, rp.z), 0.35);
          rig.group.rotation.y = rp.yaw;
        }
        for (const [uid, rig] of remotePlayerMeshes.entries()) {
          if (!seenRemoteUids.has(uid)) {
            scene.remove(rig.group);
            remotePlayerMeshes.delete(uid);
          }
        }

        // Camera & First-Person Weapon Viewmodel Kinematics
        player.recoilKickPitch = THREE.MathUtils.damp(player.recoilKickPitch, 0, 12, simDt);
        player.recoilKickZ = THREE.MathUtils.damp(player.recoilKickZ, 0, 16, simDt);
        player.cameraTrauma = Math.max(0, player.cameraTrauma - simDt * 2.4);
        player.flashAlpha = Math.max(0, player.flashAlpha - simDt * 0.38);
        player.damageIndicatorAlpha = Math.max(0, player.damageIndicatorAlpha - simDt * 1.8);
        if (player.hitMarkerTimer > 0) {
          player.hitMarkerTimer = Math.max(0, player.hitMarkerTimer - simDt);
        }

        if (muzzleLight.intensity > 0) {
          muzzleLight.intensity = Math.max(0, muzzleLight.intensity - simDt * 45);
        }

        const crouchHeld =
          keysHeld.has('ControlLeft') || keysHeld.has('ControlRight') || player.crouching;
        const targetEyeHeight = crouchHeld ? 1.05 : 1.62;
        const walkBobY = Math.sin(player.walkDistance * 2.8) * 0.032;
        const walkBobX = Math.cos(player.walkDistance * 1.4) * 0.022;

        const shake = player.cameraTrauma * player.cameraTrauma * 0.035;
        const shakeRx = (Math.random() - 0.5) * shake;
        const shakeRy = (Math.random() - 0.5) * shake;

        camera.position.x = player.x + walkBobX;
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          player.y + targetEyeHeight + walkBobY,
          14,
          simDt
        );
        camera.position.z = player.z;

        camera.rotation.order = 'YXZ';
        camera.rotation.y = player.yaw + shakeRy;
        camera.rotation.x =
          Math.max(-1.45, Math.min(1.45, player.pitch + player.recoilKickPitch)) + shakeRx;

        // Smooth FOV Zoom for ADS / AWP Sniper Scope
        const wSpec = WEAPONS[player.activeWeapon];
        const targetFov = player.aiming
          ? wSpec.zoomFov || (propsRef.current.graphics.fov || 75) * 0.72
          : propsRef.current.graphics.fov || 75;
        if (Math.abs(camera.fov - targetFov) > 0.1) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 14, simDt);
          camera.updateProjectionMatrix();
        }

        if (weaponViewGroup) {
          const adsOffsetX = player.aiming ? -0.24 : 0;
          const adsOffsetY = player.aiming ? 0.065 : 0;
          const reloadDipY =
            player.reloadTimer > 0
              ? -Math.sin((player.reloadTimer / wSpec.reloadTime) * Math.PI) * 0.22
              : 0;

          weaponViewGroup.position.x = THREE.MathUtils.damp(
            weaponViewGroup.position.x,
            adsOffsetX + walkBobX * 0.4,
            16,
            simDt
          );
          weaponViewGroup.position.y = THREE.MathUtils.damp(
            weaponViewGroup.position.y,
            adsOffsetY + reloadDipY + walkBobY * 0.5,
            16,
            simDt
          );
          weaponViewGroup.position.z = player.recoilKickZ;
          weaponViewGroup.rotation.x =
            player.reloadTimer > 0 ? -0.45 : player.recoilKickPitch * 0.6;
        }

        // Emit multiplayer network transform at 10Hz
        netEmitAccum += simDt;
        if (netEmitAccum >= 0.1 && propsRef.current.onNetworkStateEmit) {
          netEmitAccum = 0;
          propsRef.current.onNetworkStateEmit({
            x: player.x,
            y: player.y,
            z: player.z,
            yaw: player.yaw,
            pitch: player.pitch,
            weaponId: player.activeWeapon,
          });
        }
      }

      // Update Pooled Particle Ring Buffer in-place (Zero-GC)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particlePool[i];
        if (p.active) {
          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            dummyPos.set(0, -100, 0);
            dummyScale.setScalar(0);
          } else {
            p.vy -= 9.8 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            dummyPos.set(p.x, p.y, p.z);
            const s = (p.life / p.maxLife) * p.scale;
            dummyScale.setScalar(s);
            dummyColor.setHex(p.colorHex);
            particleMesh.setColorAt(i, dummyColor);
          }
        } else {
          dummyPos.set(0, -100, 0);
          dummyScale.setScalar(0);
        }
        dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
        particleMesh.setMatrixAt(i, dummyMatrix);
      }
      particleMesh.instanceMatrix.needsUpdate = true;
      if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;

      // Throttle HUD React callback to ~10Hz
      hudEmitAccum += dt;
      if (hudEmitAccum >= 0.09) {
        hudEmitAccum = 0;
        const ammo = player.ammoByWeapon[player.activeWeapon];
        const radarEntities: HudSnapshot['radarEntities'] = [
          {
            x: player.x,
            z: player.z,
            team: propsRef.current.playerTeam,
            isPlayer: true,
          },
        ];
        for (const b of bots) {
          if (b.alive) {
            radarEntities.push({ x: b.x, z: b.z, team: b.team });
          }
        }
        if (matchState.plantedPos && matchState.bombState === 'planted') {
          radarEntities.push({
            x: matchState.plantedPos.x,
            z: matchState.plantedPos.z,
            team: 'phantom',
            isBomb: true,
          });
        }

        propsRef.current.onHudUpdate({
          health: player.health,
          armor: player.armor,
          activeWeapon: player.activeWeapon,
          primaryWeapon: player.primaryWeapon,
          secondaryWeapon: player.secondaryWeapon,
          magAmmo: ammo.mag,
          reserveAmmo: ammo.reserve,
          isReloading: player.reloadTimer > 0,
          isAiming: player.aiming,
          isCrouching:
            keysHeld.has('ControlLeft') || keysHeld.has('ControlRight') || player.crouching,
          cash: player.cash,
          vanguardScore: matchState.vanguardScore,
          phantomScore: matchState.phantomScore,
          timeRemainingSec: Math.ceil(matchState.timeRemainingSec),
          playerKills: player.kills,
          playerDeaths: player.deaths,
          playerHeadshots: player.headshots,
          bombState: matchState.bombState,
          bombCountdownSec: Math.ceil(matchState.bombCountdownSec),
          nearBombSite: getNearBombSite(),
          actionProgress: matchState.actionProgress,
          flashAlpha: player.flashAlpha,
          hitMarkerType: player.hitMarkerTimer > 0 ? player.hitMarkerType : 'none',
          damageIndicatorAlpha: player.damageIndicatorAlpha,
          radarEntities,
          playerX: player.x,
          playerZ: player.z,
          playerYaw: player.yaw,
          killFeed: matchState.killFeed,
          botsScoreboard: bots.map((b) => ({
            id: b.id,
            name: b.name,
            team: b.team,
            kills: b.kills,
            deaths: b.deaths,
            alive: b.alive,
          })),
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('blur', handleBlurOrVisibility);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full z-0 select-none bg-[#090a0f]"
      aria-label="MOSAVI CS 3D Tactical Viewport"
    />
  );
};
