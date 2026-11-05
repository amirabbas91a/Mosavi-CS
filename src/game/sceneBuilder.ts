import * as THREE from 'three';
import { TacticalMapConfig, MapStructureBlock } from './maps.ts';
import { WeaponId, STORE_CATALOG } from './weapons.ts';
import sandstoneUrl from '../assets/images/tactical_sandstone_tile_1793864317552.jpg';
import concreteUrl from '../assets/images/tactical_concrete_tile_1793864317594.jpg';

export function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createProceduralBumpTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const v = 100 + Math.floor(Math.random() * 55);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createBombSiteDecalTexture(letter: 'A' | 'B'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  // Outer tactical ring
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 10;
  ctx.setLineDash([24, 14]);
  ctx.beginPath();
  ctx.arc(128, 128, 108, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.22)';
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 110px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 128, 132);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildTacticalMapGroup(
  mapConfig: TacticalMapConfig,
  renderer: THREE.WebGLRenderer,
  enableShadows: boolean
): THREE.Group {
  const root = new THREE.Group();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();

  const bumpTex = createProceduralBumpTexture(128);
  bumpTex.repeat.set(8, 8);

  const sandstoneTex = loader.load(sandstoneUrl);
  sandstoneTex.colorSpace = THREE.SRGBColorSpace;
  sandstoneTex.wrapS = THREE.RepeatWrapping;
  sandstoneTex.wrapT = THREE.RepeatWrapping;
  sandstoneTex.repeat.set(3, 3);
  sandstoneTex.anisotropy = maxAniso;

  const concreteTex = loader.load(concreteUrl);
  concreteTex.colorSpace = THREE.SRGBColorSpace;
  concreteTex.wrapS = THREE.RepeatWrapping;
  concreteTex.wrapT = THREE.RepeatWrapping;
  concreteTex.repeat.set(3, 3);
  concreteTex.anisotropy = maxAniso;

  const groundTex = loader.load(mapConfig.id === 'mosavi_dust' ? sandstoneUrl : concreteUrl);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.wrapS = THREE.RepeatWrapping;
  groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(22, 22);
  groundTex.anisotropy = maxAniso;

  // Extended terrain floor (280x280m) so horizon blends into natural fog
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: groundTex,
    bumpMap: bumpTex,
    bumpScale: 0.04,
    roughness: 0.86,
    metalness: 0.08,
  });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = enableShadows;
  root.add(groundMesh);

  // Subtle tactical lane markings offset by +0.02m on Y to avoid Z-fighting
  const roadMat = new THREE.MeshStandardMaterial({
    color: mapConfig.id === 'mosavi_dust' ? 0xa37c4c : 0x1e293b,
    roughness: 0.9,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const midLane = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 84), roadMat);
  midLane.rotation.x = -Math.PI / 2;
  midLane.position.set(0, 0.02, 0);
  midLane.receiveShadow = enableShadows;
  root.add(midLane);

  // Bomb Site A & B Ground Decals (offset at y = 0.03m)
  const siteATex = createBombSiteDecalTexture('A');
  const siteAMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({
      map: siteATex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  siteAMesh.rotation.x = -Math.PI / 2;
  siteAMesh.position.set(mapConfig.bombSiteA.x, 0.03, mapConfig.bombSiteA.z);
  root.add(siteAMesh);

  const siteBTex = createBombSiteDecalTexture('B');
  const siteBMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({
      map: siteBTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  siteBMesh.rotation.x = -Math.PI / 2;
  siteBMesh.position.set(mapConfig.bombSiteB.x, 0.03, mapConfig.bombSiteB.z);
  root.add(siteBMesh);

  // Shared PBR material palette
  const materials: Record<MapStructureBlock['materialTheme'], THREE.MeshStandardMaterial> = {
    sandstone: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sandstoneTex,
      bumpMap: bumpTex,
      bumpScale: 0.05,
      roughness: 0.82,
      metalness: 0.06,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: concreteTex,
      bumpMap: bumpTex,
      bumpScale: 0.04,
      roughness: 0.76,
      metalness: 0.14,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x475569,
      bumpMap: bumpTex,
      bumpScale: 0.02,
      roughness: 0.36,
      metalness: 0.78,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0x92623a,
      bumpMap: bumpTex,
      bumpScale: 0.03,
      roughness: 0.78,
      metalness: 0.08,
    }),
    dark_steel: new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.32,
      metalness: 0.84,
    }),
    hazard: new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.45,
      metalness: 0.55,
    }),
  };

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.75,
  });

  const windowGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.8,
  });

  // Build composite 3-6 part structures for each map block
  for (const s of mapConfig.structures) {
    const structGroup = new THREE.Group();
    structGroup.position.set(s.x, s.y, s.z);

    // 1. Primary hull
    const mainMesh = new THREE.Mesh(
      new THREE.BoxGeometry(s.w, s.h, s.d),
      materials[s.materialTheme]
    );
    mainMesh.castShadow = enableShadows;
    mainMesh.receiveShadow = enableShadows;
    structGroup.add(mainMesh);

    // 2. Secondary architectural read (roof parapet / crate frame / tower antenna)
    if (s.kind === 'tower' || s.kind === 'building') {
      const parapet = new THREE.Mesh(
        new THREE.BoxGeometry(s.w + 0.35, 0.45, s.d + 0.35),
        trimMat
      );
      parapet.position.y = s.h / 2 + 0.2;
      structGroup.add(parapet);

      // Base plinth
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(s.w + 0.25, 0.4, s.d + 0.25),
        trimMat
      );
      plinth.position.y = -s.h / 2 + 0.2;
      structGroup.add(plinth);

      // Tactical slit windows
      const slit = new THREE.Mesh(
        new THREE.BoxGeometry(s.w * 0.6, 0.5, s.d + 0.08),
        windowGlowMat
      );
      slit.position.y = s.h * 0.18;
      structGroup.add(slit);

      if (s.kind === 'tower') {
        // Radar dish / communications mast on top of landmark tower
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.18, 3.8, 8),
          materials.dark_steel
        );
        mast.position.y = s.h / 2 + 2.1;
        structGroup.add(mast);

        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        beacon.position.y = s.h / 2 + 4.0;
        structGroup.add(beacon);
      }
    } else if (s.kind === 'crate' || s.kind === 'container') {
      // Corner reinforcement bars on crates
      const strapTop = new THREE.Mesh(
        new THREE.BoxGeometry(s.w + 0.08, 0.18, s.d + 0.08),
        trimMat
      );
      strapTop.position.y = s.h / 2 - 0.12;
      structGroup.add(strapTop);

      const strapBot = new THREE.Mesh(
        new THREE.BoxGeometry(s.w + 0.08, 0.18, s.d + 0.08),
        trimMat
      );
      strapBot.position.y = -s.h / 2 + 0.12;
      structGroup.add(strapBot);
    }

    root.add(structGroup);
  }

  // Outdoor Natural Perimeter Cliffs / Skyline Silhouettes beyond compound walls (no void edges)
  const cliffMat = new THREE.MeshStandardMaterial({
    color: mapConfig.id === 'mosavi_dust' ? 0x9c7448 : 0x1e293b,
    roughness: 0.92,
    metalness: 0.05,
  });
  const cliffPositions = [
    [-70, 9, -65, 28, 18, 22],
    [0, 12, -75, 45, 24, 20],
    [70, 10, -65, 26, 20, 24],
    [-75, 11, 10, 22, 22, 40],
    [75, 11, 10, 22, 22, 40],
    [-65, 9, 70, 32, 18, 22],
    [65, 10, 70, 32, 20, 22],
  ];
  for (const [cx, cy, cz, cw, ch, cd] of cliffPositions) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), cliffMat);
    m.position.set(cx, cy, cz);
    root.add(m);
  }

  return root;
}

/**
 * Builds an articulated 8-part 3D Tactical Operator mesh (with bottom-center pivot at y=0 and contact shadow)
 */
export interface OperatorMeshRig {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  visor: THREE.Mesh;
}

export function createOperatorCharacterMesh(team: 'vanguard' | 'phantom'): OperatorMeshRig {
  const group = new THREE.Group();

  // 1. Contact shadow disc at ground level (y = 0.015)
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.65, 16),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  group.add(shadowDisc);

  const uniformColor = team === 'vanguard' ? 0x1e293b : 0x3f2e21;
  const armorColor = team === 'vanguard' ? 0x0f172a : 0x27272a;
  const accentColor = team === 'vanguard' ? 0x38bdf8 : 0xef4444;

  const uniformMat = new THREE.MeshStandardMaterial({
    color: uniformColor,
    roughness: 0.78,
    metalness: 0.12,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: armorColor,
    roughness: 0.42,
    metalness: 0.65,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.8,
  });

  // 2 & 3. Articulated Left & Right Legs
  const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.24);
  const leftLeg = new THREE.Mesh(legGeo, uniformMat);
  leftLeg.position.set(-0.15, 0.38, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, uniformMat);
  rightLeg.position.set(0.15, 0.38, 0);
  group.add(rightLeg);

  // 4. Primary Torso Kevlar Vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.34), armorMat);
  torso.position.set(0, 1.08, 0);
  group.add(torso);

  // 5. Tactical Chest Rig Plate
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.38), accentMat);
  chestPlate.position.set(0, 1.12, 0);
  group.add(chestPlate);

  // 6 & 7. Arms + Held Rifle
  const armGeo = new THREE.BoxGeometry(0.16, 0.54, 0.18);
  const leftArm = new THREE.Mesh(armGeo, uniformMat);
  leftArm.position.set(-0.36, 1.12, 0.12);
  leftArm.rotation.x = -Math.PI / 4;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, uniformMat);
  rightArm.position.set(0.36, 1.12, 0.12);
  rightArm.rotation.x = -Math.PI / 4;
  group.add(rightArm);

  const gunMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.14, 0.68),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.28, metalness: 0.88 })
  );
  gunMesh.position.set(0.24, 1.08, 0.38);
  group.add(gunMesh);

  // 8. Ballistic Helmet Head & Visor
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), armorMat);
  head.position.set(0, 1.62, 0);
  group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.18), accentMat);
  visor.position.set(0, 1.62, 0.14);
  group.add(visor);

  return { group, leftLeg, rightLeg, torso, head, visor };
}

/**
 * Builds a detailed composite 6-10 part First-Person Weapon Viewmodel attached to the camera
 */
export function buildFirstPersonWeaponModel(
  weaponId: WeaponId,
  equippedSkins: Record<string, string>
): THREE.Group {
  const group = new THREE.Group();

  const skinId = equippedSkins[weaponId] || (weaponId === 'knife' ? equippedSkins['knife'] : undefined);
  const skinSpec = skinId ? STORE_CATALOG.find((s) => s.id === skinId) : undefined;

  const primaryMat = new THREE.MeshStandardMaterial({
    color: skinSpec ? skinSpec.primaryHex : 0x1f2937,
    roughness: skinSpec ? skinSpec.roughness : 0.28,
    metalness: skinSpec ? skinSpec.metalness : 0.85,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: skinSpec ? skinSpec.accentHex : weaponId === 'ak47' ? 0x7c2d12 : 0x334155,
    roughness: 0.42,
    metalness: 0.55,
  });

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.22,
    metalness: 0.92,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: equippedSkins['gloves'] ? 0x991b1b : 0x18181b,
    roughness: 0.65,
    metalness: 0.25,
  });

  if (weaponId === 'knife') {
    // Curved Karambit / Tactical Blade
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.045), gloveMat);
    handle.position.set(0.22, -0.22, -0.38);
    group.add(handle);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16), accentMat);
    ring.position.set(0.22, -0.28, -0.38);
    group.add(ring);

    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.19, 4), accentMat);
    blade.position.set(0.22, -0.1, -0.42);
    blade.rotation.x = -0.55;
    group.add(blade);
    return group;
  }

  if (weaponId === 'grenade' || weaponId === 'smoke' || weaponId === 'flashbang') {
    const bodyColor =
      weaponId === 'grenade' ? 0x15803d : weaponId === 'smoke' ? 0x64748b : 0xfacc15;
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.13, 14),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.6 })
    );
    cyl.position.set(0.22, -0.2, -0.38);
    group.add(cyl);

    const pin = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 8, 14), barrelMat);
    pin.position.set(0.2, -0.13, -0.38);
    group.add(pin);
    return group;
  }

  // Firearms (Rifles, Sniper, SMG, Shotgun, Pistols)
  const isPistol = weaponId === 'deagle' || weaponId === 'glock' || weaponId === 'usp';
  const receiverLen = isPistol ? 0.24 : weaponId === 'awp' ? 0.62 : 0.46;

  // 1. Main Receiver
  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.058, 0.075, receiverLen),
    primaryMat
  );
  receiver.position.set(0.24, -0.21, -0.44);
  group.add(receiver);

  // 2. Handguard / Accent shroud
  const handguard = new THREE.Mesh(
    new THREE.BoxGeometry(0.064, 0.06, receiverLen * 0.55),
    accentMat
  );
  handguard.position.set(0.24, -0.21, -0.44 - receiverLen * 0.35);
  group.add(handguard);

  // 3. Precision Barrel
  const barrelLen = isPistol ? 0.14 : weaponId === 'awp' ? 0.55 : 0.36;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, barrelLen, 10),
    barrelMat
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.24, -0.19, -0.44 - receiverLen * 0.5 - barrelLen * 0.35);
  group.add(barrel);

  // 4. Suppressor for USP-S
  if (weaponId === 'usp') {
    const suppressor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.16, 12),
      barrelMat
    );
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0.24, -0.19, -0.7);
    group.add(suppressor);
  }

  // 5. Magazine
  const mag = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, isPistol ? 0.12 : 0.17, 0.065),
    accentMat
  );
  mag.position.set(0.24, -0.31, isPistol ? -0.38 : -0.48);
  mag.rotation.x = weaponId === 'ak47' ? 0.28 : 0.08;
  group.add(mag);

  // 6. Optical Scope for AWP or Tactical Rail Sight for Rifles
  if (weaponId === 'awp') {
    const scopeTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.022, 0.28, 14),
      barrelMat
    );
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0.24, -0.13, -0.44);
    group.add(scopeTube);
  } else {
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.04), accentMat);
    rearSight.position.set(0.24, -0.16, -0.35);
    group.add(rearSight);
  }

  // 7. Tactical Gloved Support Hand
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.12), gloveMat);
  hand.position.set(0.23, -0.25, -0.52);
  group.add(hand);

  return group;
}
