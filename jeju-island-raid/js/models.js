/**
 * JEJU ISLAND RAID — Procedural Character Models
 * Manhwa-accurate silhouettes built with Three.js primitives
 */
(function (global) {
  'use strict';

  const THREE = global.THREE;
  const Models = {};

  // Polyfill: CapsuleGeometry is missing in Three.js r128 (added in r142+)
  if (typeof THREE.CapsuleGeometry === 'undefined') {
    THREE.CapsuleGeometry = function CapsuleGeometry(radius, length, capSegments, radialSegments) {
      radius = radius !== undefined ? radius : 0.15;
      length = length !== undefined ? length : 0.5;
      capSegments = Math.max(2, Math.floor(capSegments !== undefined ? capSegments : 4));
      radialSegments = Math.max(3, Math.floor(radialSegments !== undefined ? radialSegments : 8));

      const path = new THREE.CurvePath();
      // Approximate capsule as a lathe-friendly cylinder + spheres via Extrude-less approach:
      // Build with Cylinder + two Sphere merges into one BufferGeometry
      const cylH = Math.max(0.001, length);
      const cyl = new THREE.CylinderGeometry(radius, radius, cylH, radialSegments, 1, true);
      const top = new THREE.SphereGeometry(radius, radialSegments, capSegments, 0, Math.PI * 2, 0, Math.PI / 2);
      const bot = new THREE.SphereGeometry(radius, radialSegments, capSegments, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      top.translate(0, cylH / 2, 0);
      bot.translate(0, -cylH / 2, 0);

      // Merge geometries (r128-compatible)
      function mergeGeos(geometries) {
        let totalVerts = 0, totalIdx = 0;
        const attrs = [];
        geometries.forEach(function (g) {
          g.computeBoundingBox();
          const pos = g.attributes.position;
          const nrm = g.attributes.normal;
          const uv = g.attributes.uv;
          const idx = g.index;
          attrs.push({ pos: pos, nrm: nrm, uv: uv, idx: idx, vCount: pos.count });
          totalVerts += pos.count;
          totalIdx += idx ? idx.count : pos.count;
        });
        const positions = new Float32Array(totalVerts * 3);
        const normals = new Float32Array(totalVerts * 3);
        const uvs = new Float32Array(totalVerts * 2);
        const indices = [];
        let vOffset = 0;
        attrs.forEach(function (a) {
          for (let i = 0; i < a.vCount; i++) {
            positions[(vOffset + i) * 3] = a.pos.getX(i);
            positions[(vOffset + i) * 3 + 1] = a.pos.getY(i);
            positions[(vOffset + i) * 3 + 2] = a.pos.getZ(i);
            if (a.nrm) {
              normals[(vOffset + i) * 3] = a.nrm.getX(i);
              normals[(vOffset + i) * 3 + 1] = a.nrm.getY(i);
              normals[(vOffset + i) * 3 + 2] = a.nrm.getZ(i);
            }
            if (a.uv) {
              uvs[(vOffset + i) * 2] = a.uv.getX(i);
              uvs[(vOffset + i) * 2 + 1] = a.uv.getY(i);
            }
          }
          if (a.idx) {
            for (let i = 0; i < a.idx.count; i++) indices.push(a.idx.getX(i) + vOffset);
          } else {
            for (let i = 0; i < a.vCount; i++) indices.push(vOffset + i);
          }
          vOffset += a.vCount;
        });
        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        merged.setIndex(indices);
        return merged;
      }

      const geo = mergeGeos([cyl, top, bot]);
      geo.type = 'CapsuleGeometry';
      return geo;
    };
    THREE.CapsuleGeometry.prototype = Object.create(THREE.BufferGeometry.prototype);
    THREE.CapsuleGeometry.prototype.constructor = THREE.CapsuleGeometry;
  }

  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: opts.roughness !== undefined ? opts.roughness : 0.45,
      metalness: opts.metalness !== undefined ? opts.metalness : 0.25,
      emissive: opts.emissive !== undefined ? opts.emissive : 0x000000,
      emissiveIntensity: opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 0,
      transparent: opts.transparent !== undefined ? opts.transparent : false,
      opacity: opts.opacity !== undefined ? opts.opacity : 1,
      flatShading: opts.flat !== undefined ? opts.flat : false,
      side: opts.side !== undefined ? opts.side : THREE.FrontSide,
    });
  }

  function glowMat(color, intensity = 0.8) {
    return mat(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.3, metalness: 0.1 });
  }

  function addLimb(parent, geo, material, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ─────────────────────────────────────────────
  // SUNG JINWOO — Shadow Monarch
  // Black coat, dual daggers, purple aura
  // ─────────────────────────────────────────────
  Models.createJinwoo = function () {
    const root = new THREE.Group();
    root.name = 'SungJinwoo';

    const black = mat(0x0a0a12, { roughness: 0.55, metalness: 0.15 });
    const coat = mat(0x111118, { roughness: 0.5, metalness: 0.2 });
    const skin = mat(0xc4a07a, { roughness: 0.7, metalness: 0.05 });
    const hair = mat(0x0d0d12, { roughness: 0.8, metalness: 0.05 });
    const purple = glowMat(0x7b2fff, 0.6);
    const steel = mat(0x8899aa, { roughness: 0.25, metalness: 0.85, emissive: 0x223344, emissiveIntensity: 0.15 });
    const eye = glowMat(0x5ee7ff, 1.2);

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.14, 0.55, 4, 8);
    addLimb(root, legGeo, black, -0.16, 0.45, 0);
    addLimb(root, legGeo, black, 0.16, 0.45, 0);
    // Boots
    const bootGeo = new THREE.BoxGeometry(0.22, 0.14, 0.34);
    addLimb(root, bootGeo, coat, -0.16, 0.07, 0.04);
    addLimb(root, bootGeo, coat, 0.16, 0.07, 0.04);

    // Torso
    const torso = addLimb(root, new THREE.CapsuleGeometry(0.28, 0.5, 4, 10), black, 0, 1.15, 0);
    // Coat flaps
    const flapL = addLimb(root, new THREE.BoxGeometry(0.22, 0.7, 0.08), coat, -0.22, 0.85, -0.08, 0.15, 0, 0.2);
    const flapR = addLimb(root, new THREE.BoxGeometry(0.22, 0.7, 0.08), coat, 0.22, 0.85, -0.08, 0.15, 0, -0.2);
    flapL.name = 'coatL'; flapR.name = 'coatR';
    // Collar
    addLimb(root, new THREE.BoxGeometry(0.42, 0.18, 0.2), coat, 0, 1.55, -0.02);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.1, 0.45, 4, 8);
    const armL = addLimb(root, armGeo, black, -0.42, 1.2, 0, 0, 0, 0.25);
    const armR = addLimb(root, armGeo, black, 0.42, 1.2, 0, 0, 0, -0.25);
    armL.name = 'armL'; armR.name = 'armR';
    // Hands
    addLimb(root, new THREE.SphereGeometry(0.09, 8, 8), skin, -0.48, 0.88, 0.05);
    addLimb(root, new THREE.SphereGeometry(0.09, 8, 8), skin, 0.48, 0.88, 0.05);

    // Dual daggers (Kamish's Wrath style — dark purple-black blades)
    const bladeGeo = new THREE.ConeGeometry(0.04, 0.7, 4);
    const hiltGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.18, 6);
    const daggerL = new THREE.Group();
    daggerL.name = 'daggerL';
    const bL = new THREE.Mesh(bladeGeo, steel);
    bL.position.y = 0.35;
    const hL = new THREE.Mesh(hiltGeo, purple);
    daggerL.add(bL, hL);
    daggerL.position.set(-0.5, 0.9, 0.15);
    daggerL.rotation.set(0.3, 0, 0.4);
    root.add(daggerL);

    const daggerR = new THREE.Group();
    daggerR.name = 'daggerR';
    const bR = new THREE.Mesh(bladeGeo, steel);
    bR.position.y = 0.35;
    const hR = new THREE.Mesh(hiltGeo, purple);
    daggerR.add(bR, hR);
    daggerR.position.set(0.5, 0.9, 0.15);
    daggerR.rotation.set(0.3, 0, -0.4);
    root.add(daggerR);

    // Head
    const head = addLimb(root, new THREE.SphereGeometry(0.2, 12, 12), skin, 0, 1.78, 0);
    head.name = 'head';
    // Hair (spiky black)
    addLimb(root, new THREE.SphereGeometry(0.21, 10, 10), hair, 0, 1.86, -0.02);
    addLimb(root, new THREE.ConeGeometry(0.08, 0.22, 5), hair, -0.1, 2.02, 0.02, 0.3, 0, -0.2);
    addLimb(root, new THREE.ConeGeometry(0.09, 0.28, 5), hair, 0.05, 2.06, -0.02, -0.1, 0, 0.1);
    addLimb(root, new THREE.ConeGeometry(0.07, 0.18, 5), hair, 0.12, 1.98, 0.05, 0.2, 0, 0.3);
    // Eyes (glowing when powered)
    const eyeL = addLimb(root, new THREE.SphereGeometry(0.035, 6, 6), eye, -0.07, 1.8, 0.17);
    const eyeR = addLimb(root, new THREE.SphereGeometry(0.035, 6, 6), eye, 0.07, 1.8, 0.17);
    eyeL.name = 'eyeL'; eyeR.name = 'eyeR';

    // Shadow aura ring
    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.02, 8, 32),
      glowMat(0x7b2fff, 1.5)
    );
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 0.05;
    aura.name = 'aura';
    root.add(aura);

    // Shadow particle anchor
    const anchor = new THREE.Object3D();
    anchor.position.y = 1.0;
    anchor.name = 'vfxAnchor';
    root.add(anchor);

    root.userData.height = 2.0;
    root.userData.radius = 0.4;
    return root;
  };

  // ─────────────────────────────────────────────
  // ANT KING (BERU form — boss)
  // Black armored exoskeleton, red eyes, wings, claws
  // ─────────────────────────────────────────────
  Models.createAntKing = function (scale = 1.0) {
    const root = new THREE.Group();
    root.name = 'AntKing';

    const carapace = mat(0x0d0d10, { roughness: 0.35, metalness: 0.55, flat: true });
    const plate = mat(0x1a1a22, { roughness: 0.3, metalness: 0.7 });
    const accent = mat(0x2a1018, { roughness: 0.4, metalness: 0.4, emissive: 0x330010, emissiveIntensity: 0.2 });
    const redEye = glowMat(0xff1a2e, 1.8);
    const claw = mat(0x2a2a30, { roughness: 0.2, metalness: 0.9 });
    const wingMat = mat(0x1a2030, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.35, side: THREE.DoubleSide, emissive: 0x112244, emissiveIntensity: 0.3 });
    const mandible = mat(0x3a1010, { roughness: 0.4, metalness: 0.5, emissive: 0x220000, emissiveIntensity: 0.3 });

    // Legs (4 insectoid + upright stance)
    const legPositions = [
      [-0.45, 0.5, 0.3], [0.45, 0.5, 0.3],
      [-0.5, 0.55, -0.25], [0.5, 0.55, -0.25],
    ];
    legPositions.forEach((p, i) => {
      const leg = addLimb(root, new THREE.CapsuleGeometry(0.1, 0.7, 3, 6), carapace, p[0], p[1], p[2], 0.2 * (i < 2 ? 1 : -1), 0, (i % 2 === 0 ? 0.4 : -0.4));
      leg.name = 'leg' + i;
      // Talon foot
      addLimb(root, new THREE.ConeGeometry(0.08, 0.25, 4), claw, p[0] * 1.15, 0.08, p[2] + 0.1, Math.PI, 0, 0);
    });

    // Massive torso
    const thorax = addLimb(root, new THREE.SphereGeometry(0.65, 12, 10), carapace, 0, 1.4, 0);
    thorax.scale.set(1.1, 1.3, 0.9);
    thorax.name = 'thorax';
    // Chest plate ridges
    addLimb(root, new THREE.BoxGeometry(0.9, 0.15, 0.7), plate, 0, 1.7, 0.25);
    addLimb(root, new THREE.BoxGeometry(0.7, 0.12, 0.6), plate, 0, 1.45, 0.3);
    addLimb(root, new THREE.BoxGeometry(0.55, 0.1, 0.5), accent, 0, 1.2, 0.28);

    // Abdomen (with pincers)
    const abdomen = addLimb(root, new THREE.SphereGeometry(0.45, 10, 8), carapace, 0, 0.95, -0.55);
    abdomen.scale.set(0.9, 0.85, 1.2);
    // Twin pincers from abdomen
    addLimb(root, new THREE.ConeGeometry(0.08, 0.4, 5), claw, -0.25, 0.7, -0.95, 1.2, 0, 0.3);
    addLimb(root, new THREE.ConeGeometry(0.08, 0.4, 5), claw, 0.25, 0.7, -0.95, 1.2, 0, -0.3);

    // Arms — massive clawed arms
    const upperArmGeo = new THREE.CapsuleGeometry(0.16, 0.55, 4, 8);
    const armL = addLimb(root, upperArmGeo, carapace, -0.85, 1.55, 0.1, 0, 0, 0.5);
    const armR = addLimb(root, upperArmGeo, carapace, 0.85, 1.55, 0.1, 0, 0, -0.5);
    armL.name = 'armL'; armR.name = 'armR';

    // Forearms
    addLimb(root, new THREE.CapsuleGeometry(0.14, 0.4, 4, 6), plate, -1.15, 1.15, 0.25, 0.4, 0, 0.3);
    addLimb(root, new THREE.CapsuleGeometry(0.14, 0.4, 4, 6), plate, 1.15, 1.15, 0.25, 0.4, 0, -0.3);

    // Claws (elongated, deadly)
    const clawGroupL = new THREE.Group();
    clawGroupL.position.set(-1.3, 0.9, 0.4);
    clawGroupL.name = 'clawsL';
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.55 + i * 0.05, 4), claw);
      c.position.set(-0.08 + i * 0.08, -0.1, 0.1 * i);
      c.rotation.set(0.8 + i * 0.1, 0, -0.3 + i * 0.15);
      clawGroupL.add(c);
    }
    root.add(clawGroupL);

    const clawGroupR = new THREE.Group();
    clawGroupR.position.set(1.3, 0.9, 0.4);
    clawGroupR.name = 'clawsR';
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.55 + i * 0.05, 4), claw);
      c.position.set(0.08 - i * 0.08, -0.1, 0.1 * i);
      c.rotation.set(0.8 + i * 0.1, 0, 0.3 - i * 0.15);
      clawGroupR.add(c);
    }
    root.add(clawGroupR);

    // Head — ant head with mandibles
    const head = addLimb(root, new THREE.SphereGeometry(0.38, 12, 10), carapace, 0, 2.25, 0.15);
    head.scale.set(1.0, 0.9, 1.15);
    head.name = 'head';
    // Crown ridges
    addLimb(root, new THREE.ConeGeometry(0.12, 0.35, 5), plate, -0.15, 2.6, 0, 0.2, 0, -0.15);
    addLimb(root, new THREE.ConeGeometry(0.14, 0.4, 5), plate, 0.05, 2.65, -0.05, -0.1, 0, 0.05);
    addLimb(root, new THREE.ConeGeometry(0.1, 0.28, 5), plate, 0.18, 2.55, 0.05, 0.15, 0, 0.2);

    // Glowing red compound eyes
    const eL = addLimb(root, new THREE.SphereGeometry(0.1, 8, 8), redEye, -0.18, 2.3, 0.35);
    const eR = addLimb(root, new THREE.SphereGeometry(0.1, 8, 8), redEye, 0.18, 2.3, 0.35);
    eL.name = 'eyeL'; eR.name = 'eyeR';
    // Eye glow sprites (extra spheres)
    addLimb(root, new THREE.SphereGeometry(0.14, 6, 6), mat(0xff1a2e, { transparent: true, opacity: 0.25, emissive: 0xff1a2e, emissiveIntensity: 2 }), -0.18, 2.3, 0.35);
    addLimb(root, new THREE.SphereGeometry(0.14, 6, 6), mat(0xff1a2e, { transparent: true, opacity: 0.25, emissive: 0xff1a2e, emissiveIntensity: 2 }), 0.18, 2.3, 0.35);

    // Mandibles
    const mandL = addLimb(root, new THREE.ConeGeometry(0.07, 0.4, 5), mandible, -0.15, 2.05, 0.4, 1.0, 0, 0.5);
    const mandR = addLimb(root, new THREE.ConeGeometry(0.07, 0.4, 5), mandible, 0.15, 2.05, 0.4, 1.0, 0, -0.5);
    mandL.name = 'mandL'; mandR.name = 'mandR';

    // Four transparent ant wings
    const wingGeo = new THREE.PlaneGeometry(1.4, 0.55);
    const wingPositions = [
      { x: -0.5, y: 1.8, z: -0.3, ry: 0.6, rz: 0.3 },
      { x: 0.5, y: 1.8, z: -0.3, ry: -0.6, rz: -0.3 },
      { x: -0.4, y: 1.55, z: -0.4, ry: 0.5, rz: 0.5 },
      { x: 0.4, y: 1.55, z: -0.4, ry: -0.5, rz: -0.5 },
    ];
    wingPositions.forEach((w, i) => {
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(w.x, w.y, w.z);
      wing.rotation.set(0.2, w.ry, w.rz);
      wing.name = 'wing' + i;
      root.add(wing);
    });

    // Aura of menace
    const menace = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.03, 8, 40),
      glowMat(0xff1a2e, 1.2)
    );
    menace.rotation.x = Math.PI / 2;
    menace.position.y = 0.1;
    menace.name = 'menace';
    root.add(menace);

    root.scale.setScalar(scale);
    root.userData.height = 2.8 * scale;
    root.userData.radius = 1.0 * scale;
    return root;
  };

  // ─────────────────────────────────────────────
  // MUTANT ANT (regular enemy)
  // ─────────────────────────────────────────────
  Models.createAnt = function (variant = 0) {
    const root = new THREE.Group();
    root.name = 'Ant';

    const colors = [0x1a2a18, 0x2a1a10, 0x152018, 0x221a14];
    const bodyC = colors[variant % colors.length];
    const shell = mat(bodyC, { roughness: 0.4, metalness: 0.4, flat: true });
    const dark = mat(0x0a0e0a, { roughness: 0.5, metalness: 0.3 });
    const eye = glowMat(0xff4422, 1.0);
    const wingM = mat(0x1a3020, { transparent: true, opacity: 0.3, side: THREE.DoubleSide, roughness: 0.2 });

    // Body segments
    addLimb(root, new THREE.SphereGeometry(0.28, 8, 8), shell, 0, 0.55, 0).scale.set(1, 1.1, 1.2);
    addLimb(root, new THREE.SphereGeometry(0.22, 8, 6), shell, 0, 0.5, -0.35).scale.set(0.9, 0.85, 1.1);
    addLimb(root, new THREE.SphereGeometry(0.2, 8, 6), dark, 0, 0.65, 0.28);

    // Legs
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const idx = i % 3;
      const z = 0.15 - idx * 0.18;
      addLimb(root, new THREE.CapsuleGeometry(0.03, 0.35, 2, 4), dark,
        side * 0.28, 0.3, z, 0.3, 0, side * 0.6);
    }

    // Mandibles
    addLimb(root, new THREE.ConeGeometry(0.04, 0.2, 4), dark, -0.08, 0.6, 0.42, 1.1, 0, 0.4);
    addLimb(root, new THREE.ConeGeometry(0.04, 0.2, 4), dark, 0.08, 0.6, 0.42, 1.1, 0, -0.4);

    // Eyes
    addLimb(root, new THREE.SphereGeometry(0.05, 6, 6), eye, -0.1, 0.72, 0.38);
    addLimb(root, new THREE.SphereGeometry(0.05, 6, 6), eye, 0.1, 0.72, 0.38);

    // Wings (flying ants)
    if (variant % 2 === 0) {
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), wingM);
      w1.position.set(-0.2, 0.7, -0.1); w1.rotation.set(0.2, 0.5, 0.3); w1.name = 'wing0';
      const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), wingM);
      w2.position.set(0.2, 0.7, -0.1); w2.rotation.set(0.2, -0.5, -0.3); w2.name = 'wing1';
      root.add(w1, w2);
    }

    root.userData.height = 0.9;
    root.userData.radius = 0.35;
    return root;
  };

  // ─────────────────────────────────────────────
  // SHADOW SOLDIERS
  // ─────────────────────────────────────────────

  // IGRIS — Blood-Red Commander knight in black/purple armor with plume
  Models.createIgris = function () {
    const root = new THREE.Group();
    root.name = 'Igris';
    const armor = mat(0x1a0a28, { roughness: 0.3, metalness: 0.7, emissive: 0x2a1050, emissiveIntensity: 0.25 });
    const plume = glowMat(0x7b2fff, 0.9);
    const blade = mat(0x2a1840, { roughness: 0.2, metalness: 0.9, emissive: 0x4a2080, emissiveIntensity: 0.4 });
    const shadow = mat(0x0a0618, { roughness: 0.5, metalness: 0.3, transparent: true, opacity: 0.92 });

    // Legs
    addLimb(root, new THREE.CapsuleGeometry(0.13, 0.5, 4, 6), armor, -0.15, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.13, 0.5, 4, 6), armor, 0.15, 0.4, 0);
    // Torso
    addLimb(root, new THREE.CapsuleGeometry(0.28, 0.45, 4, 8), armor, 0, 1.05, 0);
    addLimb(root, new THREE.BoxGeometry(0.55, 0.15, 0.35), armor, 0, 1.35, 0.05); // shoulder plate
    // Arms
    addLimb(root, new THREE.CapsuleGeometry(0.1, 0.4, 3, 6), armor, -0.4, 1.1, 0, 0, 0, 0.3);
    addLimb(root, new THREE.CapsuleGeometry(0.1, 0.4, 3, 6), armor, 0.4, 1.1, 0, 0, 0, -0.3);
    // Helmet
    addLimb(root, new THREE.SphereGeometry(0.2, 10, 8), armor, 0, 1.65, 0);
    addLimb(root, new THREE.BoxGeometry(0.28, 0.12, 0.25), armor, 0, 1.72, 0.08); // visor
    // Plume
    addLimb(root, new THREE.ConeGeometry(0.06, 0.45, 5), plume, 0, 2.0, -0.05, -0.3, 0, 0);
    // Greatsword
    const sword = new THREE.Group();
    sword.name = 'weapon';
    const bladeM = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.12), blade);
    bladeM.position.y = 0.55;
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 6), armor);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.1), plume);
    sword.add(bladeM, hilt, guard);
    sword.position.set(0.55, 0.9, 0.1);
    sword.rotation.set(0, 0, -0.3);
    root.add(sword);

    // Shadow glow base
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.015, 6, 24), glowMat(0x7b2fff, 1.2));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
    root.add(ring);

    root.userData.height = 2.0;
    root.userData.radius = 0.4;
    return root;
  };

  // IRON — bulky tank shadow with tower shield & axe
  Models.createIron = function () {
    const root = new THREE.Group();
    root.name = 'Iron';
    const armor = mat(0x1a1528, { roughness: 0.35, metalness: 0.65, emissive: 0x201040, emissiveIntensity: 0.2 });
    const steel = mat(0x3a3a50, { roughness: 0.3, metalness: 0.8 });
    const glow = glowMat(0x6b3fff, 0.7);

    // Massive body
    addLimb(root, new THREE.CapsuleGeometry(0.22, 0.45, 4, 6), armor, -0.2, 0.45, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.22, 0.45, 4, 6), armor, 0.2, 0.45, 0);
    addLimb(root, new THREE.BoxGeometry(0.75, 0.7, 0.45), armor, 0, 1.15, 0);
    addLimb(root, new THREE.BoxGeometry(0.9, 0.25, 0.5), steel, 0, 1.5, 0); // pauldrons
    addLimb(root, new THREE.CapsuleGeometry(0.14, 0.4, 3, 6), armor, -0.5, 1.1, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.14, 0.4, 3, 6), armor, 0.5, 1.1, 0);
    // Helmet (Kim Chul style bulky)
    addLimb(root, new THREE.BoxGeometry(0.35, 0.35, 0.35), armor, 0, 1.85, 0);
    addLimb(root, new THREE.BoxGeometry(0.4, 0.08, 0.4), steel, 0, 2.05, 0);
    // Tower shield
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.1), steel);
    shield.position.set(-0.65, 1.1, 0.2);
    shield.name = 'shield';
    root.add(shield);
    const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), glow);
    emblem.position.set(-0.65, 1.2, 0.26);
    root.add(emblem);
    // Axe
    const axe = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), armor);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.08), steel);
    head.position.set(0.15, 0.4, 0);
    axe.add(handle, head);
    axe.position.set(0.6, 1.0, 0.1);
    axe.rotation.z = -0.4;
    axe.name = 'weapon';
    root.add(axe);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.015, 6, 24), glow);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
    root.add(ring);

    root.userData.height = 2.1;
    root.userData.radius = 0.55;
    return root;
  };

  // TANK — Ice Bear shadow
  Models.createTank = function () {
    const root = new THREE.Group();
    root.name = 'Tank';
    const fur = mat(0x1a1830, { roughness: 0.7, metalness: 0.15, emissive: 0x151030, emissiveIntensity: 0.3 });
    const ice = glowMat(0x5ee7ff, 0.6);
    const dark = mat(0x0a0a18, { roughness: 0.6, metalness: 0.2 });

    // Body
    addLimb(root, new THREE.SphereGeometry(0.55, 10, 8), fur, 0, 0.7, 0).scale.set(1.1, 0.95, 0.9);
    // Head
    addLimb(root, new THREE.SphereGeometry(0.32, 10, 8), fur, 0, 1.25, 0.35);
    // Snout
    addLimb(root, new THREE.SphereGeometry(0.15, 8, 6), dark, 0, 1.15, 0.6);
    // Ears
    addLimb(root, new THREE.SphereGeometry(0.1, 6, 6), fur, -0.22, 1.48, 0.3);
    addLimb(root, new THREE.SphereGeometry(0.1, 6, 6), fur, 0.22, 1.48, 0.3);
    // Eyes
    addLimb(root, new THREE.SphereGeometry(0.05, 6, 6), ice, -0.12, 1.32, 0.55);
    addLimb(root, new THREE.SphereGeometry(0.05, 6, 6), ice, 0.12, 1.32, 0.55);
    // Legs
    addLimb(root, new THREE.CapsuleGeometry(0.14, 0.3, 3, 6), fur, -0.28, 0.25, 0.15);
    addLimb(root, new THREE.CapsuleGeometry(0.14, 0.3, 3, 6), fur, 0.28, 0.25, 0.15);
    addLimb(root, new THREE.CapsuleGeometry(0.14, 0.3, 3, 6), fur, -0.28, 0.25, -0.25);
    addLimb(root, new THREE.CapsuleGeometry(0.14, 0.3, 3, 6), fur, 0.28, 0.25, -0.25);
    // Ice claws
    for (let s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        addLimb(root, new THREE.ConeGeometry(0.03, 0.18, 4), ice, s * (0.3 + i * 0.05), 0.08, 0.25 + i * 0.02, Math.PI * 0.5, 0, 0);
      }
    }

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.015, 6, 24), ice);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
    root.add(ring);

    root.userData.height = 1.6;
    root.userData.radius = 0.6;
    return root;
  };

  // TUSK — High Orc Shaman with staff, purple magic
  Models.createTusk = function () {
    const root = new THREE.Group();
    root.name = 'Tusk';
    const body = mat(0x1a1230, { roughness: 0.5, metalness: 0.3, emissive: 0x201050, emissiveIntensity: 0.25 });
    const robe = mat(0x2a1850, { roughness: 0.55, metalness: 0.2, emissive: 0x301870, emissiveIntensity: 0.3 });
    const magic = glowMat(0xa855f7, 1.2);
    const tusk = mat(0xccc8b0, { roughness: 0.4, metalness: 0.1 });

    // Body
    addLimb(root, new THREE.CapsuleGeometry(0.2, 0.4, 4, 6), body, -0.15, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.2, 0.4, 4, 6), body, 0.15, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.35, 0.5, 4, 8), robe, 0, 1.05, 0);
    // Robe bottom
    addLimb(root, new THREE.CylinderGeometry(0.4, 0.5, 0.5, 8), robe, 0, 0.55, 0);
    // Arms
    addLimb(root, new THREE.CapsuleGeometry(0.1, 0.4, 3, 6), body, -0.45, 1.15, 0, 0, 0, 0.4);
    addLimb(root, new THREE.CapsuleGeometry(0.1, 0.4, 3, 6), body, 0.45, 1.15, 0, 0, 0, -0.4);
    // Head (orc)
    addLimb(root, new THREE.SphereGeometry(0.25, 10, 8), body, 0, 1.7, 0);
    // Tusks
    addLimb(root, new THREE.ConeGeometry(0.04, 0.2, 5), tusk, -0.1, 1.55, 0.2, 0.8, 0, 0.3);
    addLimb(root, new THREE.ConeGeometry(0.04, 0.2, 5), tusk, 0.1, 1.55, 0.2, 0.8, 0, -0.3);
    // Eyes
    addLimb(root, new THREE.SphereGeometry(0.04, 6, 6), magic, -0.08, 1.75, 0.2);
    addLimb(root, new THREE.SphereGeometry(0.04, 6, 6), magic, 0.08, 1.75, 0.2);
    // Staff
    const staff = new THREE.Group();
    staff.name = 'weapon';
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.8, 6), body);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), magic);
    orb.position.y = 1.0;
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 16), magic);
    ring1.position.y = 1.0; ring1.rotation.x = Math.PI / 2;
    staff.add(pole, orb, ring1);
    staff.position.set(0.55, 0.9, 0);
    root.add(staff);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.015, 6, 24), magic);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
    root.add(ring);

    root.userData.height = 2.0;
    root.userData.radius = 0.45;
    return root;
  };

  // Shadow infantry (generic soldiers)
  Models.createShadowSoldier = function (idx = 0) {
    const root = new THREE.Group();
    root.name = 'ShadowSoldier';
    const body = mat(0x120a22, { roughness: 0.45, metalness: 0.4, emissive: 0x1a0a40, emissiveIntensity: 0.35, transparent: true, opacity: 0.88 });
    const glow = glowMat(0x7b2fff, 0.8);
    const weapon = mat(0x2a1848, { roughness: 0.25, metalness: 0.8, emissive: 0x3a2060, emissiveIntensity: 0.3 });

    addLimb(root, new THREE.CapsuleGeometry(0.1, 0.4, 3, 5), body, -0.12, 0.35, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.1, 0.4, 3, 5), body, 0.12, 0.35, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.2, 0.4, 3, 6), body, 0, 0.95, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.08, 0.35, 3, 5), body, -0.32, 1.0, 0, 0, 0, 0.3);
    addLimb(root, new THREE.CapsuleGeometry(0.08, 0.35, 3, 5), body, 0.32, 1.0, 0, 0, 0, -0.3);
    addLimb(root, new THREE.SphereGeometry(0.14, 8, 6), body, 0, 1.45, 0);
    // Weapon variety
    if (idx % 3 === 0) {
      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 4), weapon);
      spear.position.set(0.35, 0.9, 0.1); spear.rotation.z = -0.3;
      root.add(spear);
    } else if (idx % 3 === 1) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.08), weapon);
      sw.position.set(0.35, 0.9, 0.1); sw.rotation.z = -0.4;
      root.add(sw);
    } else {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 4, 12, Math.PI), weapon);
      bow.position.set(0.3, 1.0, 0.1); bow.rotation.y = Math.PI / 2;
      root.add(bow);
    }

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.01, 4, 16), glow);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
    root.add(ring);

    root.userData.height = 1.6;
    root.userData.radius = 0.3;
    return root;
  };

  // ─────────────────────────────────────────────
  // ALLIED HUNTERS
  // ─────────────────────────────────────────────

  // Cha Hae-In — blonde swordswoman, white/silver armor
  Models.createChaHaeIn = function () {
    const root = new THREE.Group();
    root.name = 'ChaHaeIn';
    const armor = mat(0xe8e4dc, { roughness: 0.35, metalness: 0.55 });
    const cloth = mat(0xf0ece4, { roughness: 0.6, metalness: 0.1 });
    const skin = mat(0xe0b898, { roughness: 0.7, metalness: 0.05 });
    const hair = mat(0xe8d090, { roughness: 0.55, metalness: 0.1 });
    const blade = mat(0xd0e8ff, { roughness: 0.15, metalness: 0.95, emissive: 0xa0d0ff, emissiveIntensity: 0.35 });
    const gold = mat(0xc9a227, { roughness: 0.3, metalness: 0.8 });

    addLimb(root, new THREE.CapsuleGeometry(0.11, 0.5, 4, 6), cloth, -0.12, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.11, 0.5, 4, 6), cloth, 0.12, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), armor, 0, 1.05, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.08, 0.4, 3, 6), armor, -0.35, 1.1, 0, 0, 0, 0.2);
    addLimb(root, new THREE.CapsuleGeometry(0.08, 0.4, 3, 6), armor, 0.35, 1.1, 0, 0, 0, -0.2);
    // Head
    addLimb(root, new THREE.SphereGeometry(0.16, 10, 8), skin, 0, 1.6, 0);
    // Blonde hair
    addLimb(root, new THREE.SphereGeometry(0.17, 8, 8), hair, 0, 1.68, -0.02);
    addLimb(root, new THREE.CapsuleGeometry(0.06, 0.35, 3, 5), hair, -0.12, 1.4, -0.1, 0.3, 0, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.06, 0.4, 3, 5), hair, 0.1, 1.35, -0.12, 0.4, 0, 0);
    // Eyes
    addLimb(root, new THREE.SphereGeometry(0.025, 5, 5), mat(0x4a7a50), -0.05, 1.62, 0.14);
    addLimb(root, new THREE.SphereGeometry(0.025, 5, 5), mat(0x4a7a50), 0.05, 1.62, 0.14);
    // Sword of Light
    const sword = new THREE.Group();
    sword.name = 'weapon';
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.95, 0.1), blade);
    b.position.y = 0.5;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.2, 6), gold);
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.08), gold);
    sword.add(b, h, g);
    sword.position.set(0.4, 0.85, 0.1);
    sword.rotation.z = -0.25;
    root.add(sword);

    root.userData.height = 1.75;
    root.userData.radius = 0.35;
    return root;
  };

  // Baek Yoonho — White Tiger, beast transformation
  Models.createBaekYoonho = function () {
    const root = new THREE.Group();
    root.name = 'BaekYoonho';
    const suit = mat(0x1a1a1e, { roughness: 0.5, metalness: 0.3 });
    const white = mat(0xe8e8f0, { roughness: 0.45, metalness: 0.2 });
    const skin = mat(0xc4a070, { roughness: 0.7, metalness: 0.05 });
    const hair = mat(0xf0f0f5, { roughness: 0.6, metalness: 0.1 });
    const eye = glowMat(0xffaa22, 0.8);
    const claw = mat(0xe8e8f0, { roughness: 0.3, metalness: 0.5 });

    addLimb(root, new THREE.CapsuleGeometry(0.15, 0.5, 4, 6), suit, -0.16, 0.42, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.15, 0.5, 4, 6), suit, 0.16, 0.42, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.3, 0.5, 4, 8), suit, 0, 1.1, 0);
    // Beast arms (transformed)
    addLimb(root, new THREE.CapsuleGeometry(0.14, 0.45, 4, 6), white, -0.45, 1.15, 0, 0, 0, 0.35);
    addLimb(root, new THREE.CapsuleGeometry(0.14, 0.45, 4, 6), white, 0.45, 1.15, 0, 0, 0, -0.35);
    // Claws
    for (let s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        addLimb(root, new THREE.ConeGeometry(0.03, 0.2, 4), claw, s * (0.55 + i * 0.04), 0.85, 0.1 + i * 0.03, 0.5, 0, s * 0.2);
      }
    }
    // Head
    addLimb(root, new THREE.SphereGeometry(0.18, 10, 8), skin, 0, 1.7, 0);
    addLimb(root, new THREE.SphereGeometry(0.19, 8, 8), hair, 0, 1.78, -0.02);
    // Tiger eyes
    addLimb(root, new THREE.SphereGeometry(0.035, 6, 6), eye, -0.07, 1.72, 0.15);
    addLimb(root, new THREE.SphereGeometry(0.035, 6, 6), eye, 0.07, 1.72, 0.15);
    // White tiger markings
    addLimb(root, new THREE.BoxGeometry(0.08, 0.25, 0.02), white, -0.12, 1.15, 0.28);
    addLimb(root, new THREE.BoxGeometry(0.08, 0.25, 0.02), white, 0.12, 1.15, 0.28);

    root.userData.height = 1.9;
    root.userData.radius = 0.4;
    return root;
  };

  // Choi Jong-In — Fire Mage, coat + flame aura
  Models.createChoiJongIn = function () {
    const root = new THREE.Group();
    root.name = 'ChoiJongIn';
    const coat = mat(0x1a1010, { roughness: 0.45, metalness: 0.25, emissive: 0x2a0808, emissiveIntensity: 0.15 });
    const red = mat(0x8b1a1a, { roughness: 0.4, metalness: 0.3 });
    const skin = mat(0xc4a070, { roughness: 0.7, metalness: 0.05 });
    const hair = mat(0x2a1a10, { roughness: 0.6, metalness: 0.05 });
    const fire = glowMat(0xff6b2d, 1.4);

    addLimb(root, new THREE.CapsuleGeometry(0.12, 0.5, 4, 6), coat, -0.14, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.12, 0.5, 4, 6), coat, 0.14, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.25, 0.5, 4, 8), coat, 0, 1.1, 0);
    // Coat tails
    addLimb(root, new THREE.BoxGeometry(0.2, 0.6, 0.08), red, -0.2, 0.7, -0.1, 0.2, 0, 0.15);
    addLimb(root, new THREE.BoxGeometry(0.2, 0.6, 0.08), red, 0.2, 0.7, -0.1, 0.2, 0, -0.15);
    addLimb(root, new THREE.CapsuleGeometry(0.09, 0.4, 3, 6), coat, -0.38, 1.15, 0, 0, 0, 0.25);
    addLimb(root, new THREE.CapsuleGeometry(0.09, 0.4, 3, 6), coat, 0.38, 1.15, 0, 0, 0, -0.25);
    // Head
    addLimb(root, new THREE.SphereGeometry(0.17, 10, 8), skin, 0, 1.7, 0);
    addLimb(root, new THREE.SphereGeometry(0.18, 8, 8), hair, 0, 1.78, -0.02);
    // Fire orb in hand
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), fire);
    orb.position.set(0.5, 1.0, 0.15);
    orb.name = 'fireOrb';
    root.add(orb);
    // Flame crown effect
    addLimb(root, new THREE.ConeGeometry(0.05, 0.2, 5), fire, -0.1, 1.95, 0);
    addLimb(root, new THREE.ConeGeometry(0.04, 0.15, 5), fire, 0.08, 1.92, 0.05);

    root.userData.height = 1.85;
    root.userData.radius = 0.35;
    return root;
  };

  // Ma Dongwook — Tanker, massive build
  Models.createMaDongwook = function () {
    const root = new THREE.Group();
    root.name = 'MaDongwook';
    const armor = mat(0x3a3a45, { roughness: 0.4, metalness: 0.6 });
    const skin = mat(0xb09060, { roughness: 0.7, metalness: 0.05 });
    const hair = mat(0x1a1a1a, { roughness: 0.7, metalness: 0.05 });

    addLimb(root, new THREE.CapsuleGeometry(0.2, 0.45, 4, 6), armor, -0.22, 0.42, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.2, 0.45, 4, 6), armor, 0.22, 0.42, 0);
    addLimb(root, new THREE.BoxGeometry(0.8, 0.7, 0.5), armor, 0, 1.15, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.16, 0.4, 3, 6), armor, -0.55, 1.15, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.16, 0.4, 3, 6), armor, 0.55, 1.15, 0);
    addLimb(root, new THREE.SphereGeometry(0.2, 10, 8), skin, 0, 1.75, 0);
    addLimb(root, new THREE.SphereGeometry(0.12, 6, 6), hair, 0, 1.9, -0.02);
    // Gauntlets
    addLimb(root, new THREE.BoxGeometry(0.22, 0.22, 0.22), armor, -0.6, 0.85, 0.05);
    addLimb(root, new THREE.BoxGeometry(0.22, 0.22, 0.22), armor, 0.6, 0.85, 0.05);

    root.userData.height = 2.0;
    root.userData.radius = 0.5;
    return root;
  };

  // Lim Tae-Gyu — Archer
  Models.createLimTaeGyu = function () {
    const root = new THREE.Group();
    root.name = 'LimTaeGyu';
    const suit = mat(0x1a2a1a, { roughness: 0.5, metalness: 0.25 });
    const skin = mat(0xc4a070, { roughness: 0.7, metalness: 0.05 });
    const hair = mat(0x2a2010, { roughness: 0.6, metalness: 0.05 });
    const bowM = mat(0x4a3020, { roughness: 0.4, metalness: 0.3 });
    const glow = glowMat(0x3dff9a, 0.6);

    addLimb(root, new THREE.CapsuleGeometry(0.11, 0.5, 4, 6), suit, -0.12, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.11, 0.5, 4, 6), suit, 0.12, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.2, 0.45, 4, 8), suit, 0, 1.05, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.08, 0.4, 3, 6), suit, -0.35, 1.1, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.08, 0.4, 3, 6), suit, 0.35, 1.1, 0);
    addLimb(root, new THREE.SphereGeometry(0.15, 10, 8), skin, 0, 1.6, 0);
    addLimb(root, new THREE.SphereGeometry(0.16, 8, 8), hair, 0, 1.68, -0.02);
    // Bow
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 4, 16, Math.PI * 1.2), bowM);
    bow.position.set(0.35, 1.1, 0.1);
    bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
    bow.name = 'weapon';
    root.add(bow);
    // Quiver glow
    addLimb(root, new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), glow, -0.25, 1.2, -0.2);

    root.userData.height = 1.8;
    root.userData.radius = 0.35;
    return root;
  };

  // Min Byung-Gyu — Healer
  Models.createMinByungGyu = function () {
    const root = new THREE.Group();
    root.name = 'MinByungGyu';
    const robe = mat(0xe8f0e8, { roughness: 0.5, metalness: 0.15 });
    const green = mat(0x2a6a3a, { roughness: 0.4, metalness: 0.2 });
    const skin = mat(0xc4a070, { roughness: 0.7, metalness: 0.05 });
    const hair = mat(0x3a3020, { roughness: 0.6, metalness: 0.05 });
    const heal = glowMat(0x3dff9a, 1.0);

    addLimb(root, new THREE.CapsuleGeometry(0.11, 0.5, 4, 6), robe, -0.12, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.11, 0.5, 4, 6), robe, 0.12, 0.4, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), robe, 0, 1.1, 0);
    addLimb(root, new THREE.CylinderGeometry(0.35, 0.4, 0.5, 8), robe, 0, 0.55, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.08, 0.4, 3, 6), robe, -0.35, 1.15, 0);
    addLimb(root, new THREE.CapsuleGeometry(0.08, 0.4, 3, 6), robe, 0.35, 1.15, 0);
    addLimb(root, new THREE.SphereGeometry(0.16, 10, 8), skin, 0, 1.68, 0);
    addLimb(root, new THREE.SphereGeometry(0.17, 8, 8), hair, 0, 1.76, -0.02);
    // Staff with heal crystal
    const staff = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 6), green);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), heal);
    crystal.position.y = 0.85;
    staff.add(pole, crystal);
    staff.position.set(0.45, 0.85, 0);
    staff.name = 'weapon';
    root.add(staff);

    root.userData.height = 1.8;
    root.userData.radius = 0.35;
    return root;
  };

  // ─────────────────────────────────────────────
  // ENVIRONMENT PIECES
  // ─────────────────────────────────────────────
  Models.createAntNestRock = function (size = 1) {
    const geo = new THREE.DodecahedronGeometry(size, 0);
    const m = mat(0x3a3428, { roughness: 0.9, metalness: 0.05, flat: true });
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.scale.set(1 + Math.random() * 0.5, 0.6 + Math.random() * 0.8, 1 + Math.random() * 0.4);
    return mesh;
  };

  Models.createNestPillar = function (h = 8) {
    const g = new THREE.Group();
    const rock = mat(0x2a2418, { roughness: 0.85, metalness: 0.05, flat: true });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8 + Math.random() * 0.4, 1.2, h, 6), rock);
    pillar.position.y = h / 2;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    g.add(pillar);
    // Organic ant resin
    const resin = mat(0x1a3010, { roughness: 0.6, metalness: 0.1, emissive: 0x0a2005, emissiveIntensity: 0.15 });
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), resin);
    blob.position.set(0.6, h * 0.3, 0.3);
    blob.scale.set(1, 1.5, 0.8);
    g.add(blob);
    return g;
  };

  Models.createQueenChamber = function () {
    // Large organic chamber walls marker
    const g = new THREE.Group();
    return g;
  };

  Models.createEgg = function () {
    const egg = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 10, 8),
      mat(0x2a3a20, { roughness: 0.5, metalness: 0.2, emissive: 0x1a3010, emissiveIntensity: 0.3 })
    );
    egg.scale.set(1, 1.4, 1);
    egg.castShadow = true;
    return egg;
  };

  global.JejuModels = Models;
})(typeof window !== 'undefined' ? window : globalThis);
