/**
 * JEJU ISLAND RAID — Main Game Engine
 * Solo Leveling: Play as Sung Jin-Woo
 */
(function () {
  'use strict';

  // Boot guards — never crash the whole page if a dependency is late/missing
  if (!window.THREE) {
    console.error('[Jeju] THREE missing — game.js loaded too early');
    return;
  }
  if (!window.JejuModels || !window.JejuVFX || !window.JejuEntities) {
    console.error('[Jeju] Modules missing', {
      models: !!window.JejuModels,
      vfx: !!window.JejuVFX,
      entities: !!window.JejuEntities
    });
    return;
  }

  const THREE = window.THREE;
  const Models = window.JejuModels;
  const VFX = window.JejuVFX;
  const Entities = window.JejuEntities;
  const SKILLS = Entities.SKILLS || {};

  // ═══════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════
  const Game = {
    mode: 'title', // title | loading | playing | cinematic | paused | victory | defeat
    phase: 0, // 0=beach landing, 1=nest push, 2=queen chamber, 3=ant king, 4=aftermath
    time: 0,
    kills: 0,
    extracted: 0,
    storyBeats: new Set(),
    bossSpawned: false,
    bossDefeated: false,
    beruExtracted: false,
    domainTimer: 0,
    objective: '',
  };

  let renderer, scene, camera, clock, vfx;
  let player, boss = null;
  let enemies = [];
  let allies = [];
  let shadows = [];
  let worldBounds = { minX: -80, maxX: 80, minZ: -80, maxZ: 120 };
  let keys = {};
  let mouse = { x: 0, y: 0, down: false, right: false, locked: false };
  // God of War / cinematic 3rd-person: over-shoulder, locked behind character
    let cameraAngle = { yaw: 0, pitch: 0.28, dist: 5.5, shoulder: 0.55, lookHeight: 1.45, fov: 52 };
    // legacy alias used nowhere after rewrite
    let _camLegacy = null;
  let spawnTimer = 0;
  let waveNumber = 0;
  let minimapCtx = null;
  let audioCtx = null;
  let lastAttack = 0;

  // DOM refs
  const $ = (id) => document.getElementById(id);

  // ═══════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════
  function init() {
    try {
      setupDOM();
      setupRenderer();
      setupInput();
      setupMinimap();
      clock = new THREE.Clock();
      animate();
      console.log('[Jeju] init complete — ready to play');
      // Mark title ready
      var btn = document.getElementById('btn-start');
      if (btn) btn.disabled = false;
    } catch (err) {
      console.error('[Jeju] init failed', err);
      var el = document.getElementById('boot-error');
      if (el) {
        el.className = 'show';
        el.textContent = 'Init failed: ' + (err && err.message ? err.message : err);
      }
    }
  }

  function setupDOM() {
    $('btn-start').addEventListener('click', startGame);
    $('btn-how').addEventListener('click', () => {
      $('how-panel').classList.toggle('hidden');
    });
    $('btn-resume').addEventListener('click', () => setPaused(false));
    $('btn-restart').addEventListener('click', () => { location.reload(); });
    $('btn-title').addEventListener('click', () => { location.reload(); });
    $('btn-victory-again').addEventListener('click', () => location.reload());
    $('btn-defeat-again').addEventListener('click', () => location.reload());

    // Skill bar clicks
    document.querySelectorAll('.skill-slot').forEach(el => {
      el.addEventListener('click', () => {
        const skill = el.dataset.skill;
        if (skill) trySkill(skill);
      });
    });

    // Floating particles on title
    const sp = $('screen-particles');
    if (sp) {
      for (let i = 0; i < 40; i++) {
        const s = document.createElement('span');
        s.style.left = Math.random() * 100 + '%';
        s.style.animationDelay = Math.random() * 8 + 's';
        s.style.animationDuration = 6 + Math.random() * 6 + 's';
        sp.appendChild(s);
      }
    }
  }

  function setupRenderer() {
    const canvas = $('game-canvas');
    if (!canvas) throw new Error('game-canvas element missing');

    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      });
    } catch (e1) {
      // Retry simpler context
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    if (THREE.PCFSoftShadowMap !== undefined) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }
    if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c14);
    scene.fog = new THREE.FogExp2(0x0a1020, 0.018);

    // Cinematic 3rd-person FOV (God of War style)
    camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.15, 400);
    camera.position.set(0, 3, 8);

    window.addEventListener('resize', function () {
      if (!camera || !renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function setupInput() {
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'Escape') {
        if (Game.mode === 'playing') setPaused(true);
        else if (Game.mode === 'paused') setPaused(false);
      }
      if (Game.mode !== 'playing') return;
      // Skills
      if (e.code === 'Digit1') trySkill('mutilation');
      if (e.code === 'Digit2') trySkill('daggerRush');
      if (e.code === 'Digit3') trySkill('bloodlust');
      if (e.code === 'Digit4') trySkill('rulersAuthority');
      if (e.code === 'Digit5') trySkill('monarchDomain');
      if (e.code === 'KeyQ') trySkill('quicksilver');
      if (e.code === 'KeyE') trySkill('stealth');
      if (e.code === 'KeyR') trySkill('shadowExchange');
      if (e.code === 'KeyF') trySkill('arise');
      if (e.code === 'KeyC') trySkill('quicksilver');
      if (e.code === 'Space') { e.preventDefault(); trySkill('shadowExchange'); }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    const canvas = $('game-canvas');
    canvas.addEventListener('click', () => {
      if (Game.mode === 'playing' && !mouse.locked) {
        canvas.requestPointerLock?.();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      mouse.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      // Custom cursor
      const c = $('cursor'); const d = $('cursor-dot');
      if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }
      if (d) { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }

      if (Game.mode !== 'playing') return;
      // Always rotate camera when pointer locked; also with RMB held
      if (mouse.locked || mouse.right || mouse.down) {
        cameraAngle.yaw -= e.movementX * 0.0032;
        cameraAngle.pitch = Math.max(-0.15, Math.min(0.85, cameraAngle.pitch + e.movementY * 0.0028));
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        mouse.down = true;
        $('cursor')?.classList.add('attack');
        if (Game.mode === 'playing') doBasicAttack();
      }
      if (e.button === 2) mouse.right = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) { mouse.down = false; $('cursor')?.classList.remove('attack'); }
      if (e.button === 2) mouse.right = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => {
      // Zoom in/out — closer = more intimate GoW combat feel
      cameraAngle.dist = Math.max(3.2, Math.min(11, cameraAngle.dist + e.deltaY * 0.008));
    }, { passive: true });

    // Touch
    setupTouch();
  }

  function setupTouch() {
    const stick = document.querySelector('.stick-zone');
    const knob = document.querySelector('.stick-knob');
    if (!stick) return;
    let touchId = null, origin = { x: 0, y: 0 };
    window._touchMove = { x: 0, y: 0 };

    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      touchId = t.identifier;
      const r = stick.getBoundingClientRect();
      origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      e.preventDefault();
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue;
        let dx = (t.clientX - origin.x) / 50;
        let dy = (t.clientY - origin.y) / 50;
        const len = Math.hypot(dx, dy) || 1;
        if (len > 1) { dx /= len; dy /= len; }
        window._touchMove = { x: dx, y: dy };
        if (knob) {
          knob.style.transform = `translate(calc(-50% + ${dx * 30}px), calc(-50% + ${dy * 30}px))`;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = () => {
      touchId = null;
      window._touchMove = { x: 0, y: 0 };
      if (knob) knob.style.transform = 'translate(-50%, -50%)';
    };
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);

    document.querySelector('.atk-btn')?.addEventListener('touchstart', (e) => {
      e.preventDefault(); doBasicAttack();
    }, { passive: false });

    document.querySelectorAll('.sk-btn').forEach(btn => {
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        trySkill(btn.dataset.skill);
      }, { passive: false });
    });
  }

  function setupMinimap() {
    const c = $('minimap-canvas');
    if (c) minimapCtx = c.getContext('2d');
  }

  // ═══════════════════════════════════════════
  // WORLD BUILD
  // ═══════════════════════════════════════════
  function buildWorld() {
    // Lighting
    const amb = new THREE.AmbientLight(0x3a4060, 0.45);
    scene.add(amb);

    const sun = new THREE.DirectionalLight(0xffe0c0, 0.9);
    sun.position.set(-30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    const moon = new THREE.DirectionalLight(0x4060ff, 0.25);
    moon.position.set(20, 30, -40);
    scene.add(moon);

    // Purple rim (shadow energy in air)
    const rim = new THREE.PointLight(0x7b2fff, 0.8, 80);
    rim.position.set(0, 15, 40);
    scene.add(rim);
    Game._rimLight = rim;

    // Ground — Jeju volcanic / nest terrain
    const groundGeo = new THREE.PlaneGeometry(200, 220, 80, 80);
    // Displace for uneven terrain
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const n = Math.sin(x * 0.08) * Math.cos(y * 0.06) * 0.6
              + Math.sin(x * 0.2 + y * 0.15) * 0.25;
      pos.setZ(i, n);
    }
    groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a2218,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.set(0, 0, 20);
    scene.add(ground);

    // Darker nest path toward chamber (north)
    const pathGeo = new THREE.PlaneGeometry(18, 100);
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x12180e,
      roughness: 0.95,
      metalness: 0.02,
    });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.05, 40);
    path.receiveShadow = true;
    scene.add(path);

    // Rocks and pillars
    for (let i = 0; i < 60; i++) {
      const rock = Models.createAntNestRock(0.8 + Math.random() * 2);
      rock.position.set(
        (Math.random() - 0.5) * 140,
        0,
        (Math.random() - 0.5) * 160 + 20
      );
      rock.rotation.y = Math.random() * Math.PI;
      scene.add(rock);
    }
    for (let i = 0; i < 18; i++) {
      const pillar = Models.createNestPillar(5 + Math.random() * 10);
      const side = i % 2 === 0 ? -1 : 1;
      pillar.position.set(
        side * (12 + Math.random() * 25),
        0,
        10 + i * 6 + Math.random() * 4
      );
      scene.add(pillar);
    }

    // Nest entrance (north) — organic arch
    const nestGroup = new THREE.Group();
    const nestMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a14,
      roughness: 0.7,
      metalness: 0.15,
      emissive: 0x0a1a05,
      emissiveIntensity: 0.2,
      flatShading: true,
    });
    // Chamber walls
    for (let a = 0; a < Math.PI * 2; a += 0.4) {
      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5 + Math.random(), 2.5, 12 + Math.random() * 6, 5),
        nestMat
      );
      wall.position.set(Math.cos(a) * 22, 5, 95 + Math.sin(a) * 18);
      wall.castShadow = true;
      nestGroup.add(wall);
    }
    // Floor of chamber
    const chamberFloor = new THREE.Mesh(
      new THREE.CircleGeometry(20, 24),
      new THREE.MeshStandardMaterial({ color: 0x0e160a, roughness: 0.9, metalness: 0.1 })
    );
    chamberFloor.rotation.x = -Math.PI / 2;
    chamberFloor.position.set(0, 0.1, 95);
    chamberFloor.receiveShadow = true;
    nestGroup.add(chamberFloor);

    // Eggs
    for (let i = 0; i < 8; i++) {
      const egg = Models.createEgg();
      const a = (i / 8) * Math.PI * 2;
      egg.position.set(Math.cos(a) * 10, 0.5, 95 + Math.sin(a) * 8);
      nestGroup.add(egg);
    }

    // Giant broken egg shell (Ant King birth)
    const brokenEgg = new THREE.Mesh(
      new THREE.SphereGeometry(4, 12, 8, 0, Math.PI * 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x2a3a18, roughness: 0.6, metalness: 0.2,
        emissive: 0x1a3008, emissiveIntensity: 0.3, side: THREE.DoubleSide, flatShading: true,
      })
    );
    brokenEgg.position.set(0, 2, 95);
    brokenEgg.rotation.x = 0.3;
    nestGroup.add(brokenEgg);

    // Queen corpse (large ant body)
    const queen = Models.createAntKing(2.2);
    queen.position.set(-8, 0, 100);
    queen.rotation.z = Math.PI / 2;
    queen.rotation.y = 0.4;
    queen.scale.y *= 0.6;
    queen.traverse(c => {
      if (c.isMesh && c.material) {
        c.material = c.material.clone();
        c.material.color?.offsetHSL(0, -0.3, -0.2);
        c.material.emissiveIntensity = 0.05;
      }
    });
    nestGroup.add(queen);

    // Red ambient in chamber
    const nestLight = new THREE.PointLight(0xff2d55, 1.2, 40);
    nestLight.position.set(0, 8, 95);
    nestGroup.add(nestLight);
    const nestPurple = new THREE.PointLight(0x7b2fff, 0.5, 30);
    nestPurple.position.set(5, 6, 90);
    nestGroup.add(nestPurple);

    scene.add(nestGroup);
    Game.nestGroup = nestGroup;

    // Sky dome stars
    const starGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 120 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaaccff, size: 0.3, sizeAttenuation: true }));
    scene.add(stars);

    // Beach zone marker (south spawn)
    const beachLight = new THREE.PointLight(0xffcc88, 0.4, 30);
    beachLight.position.set(0, 5, -20);
    scene.add(beachLight);

    // Atmospheric fog particles (distant)
    vfx = new VFX(scene);
  }

  // ═══════════════════════════════════════════
  // START GAME
  // ═══════════════════════════════════════════
  function startGame() {
    $('title-screen').classList.add('hidden');
    $('loading-screen').classList.remove('hidden');
    Game.mode = 'loading';
    let progress = 0;
    let worldReady = false;
    let loadFailed = false;

    const setLoadMsg = (t) => {
      const el = $('loading-text');
      if (el) el.textContent = t;
    };
    const setBar = (p) => {
      const el = $('loading-bar');
      if (el) el.style.width = Math.min(100, p) + '%';
    };

    const msgs = [
      'Opening Shadow Gate...',
      'Materializing Shadow Army...',
      'Scanning Jeju Island S-Rank Gate...',
      'Korean Raid Party status: CRITICAL...',
      'Shadow Exchange coordinates locked...',
      'System: Player Sung Jin-Woo — Level 100',
      'Entering the Nest...',
    ];

    // Hard timeout — never stay stuck on Initializing
    const hardTimeout = setTimeout(() => {
      if (Game.mode === 'loading') {
        console.warn('[Jeju] Hard timeout — forcing beginPlay');
        setBar(100);
        setLoadMsg('Force entering gate...');
        beginPlay();
      }
    }, 8000);

    const loadStep = () => {
      if (Game.mode !== 'loading') return;
      // Always advance UI — never freeze on "Initializing..."
      if (worldReady) progress += 20;
      else progress += 8;
      if (!worldReady && progress > 92) progress = 92;
      if (progress > 100) progress = 100;
      setBar(progress);
      setLoadMsg(msgs[Math.min(msgs.length - 1, Math.floor(progress / 14))] || 'Loading...');

      if (progress >= 100 && worldReady) {
        clearTimeout(hardTimeout);
        setTimeout(beginPlay, 200);
      } else {
        setTimeout(loadStep, 60);
      }
    };

    // Build world with error isolation — enter play as soon as ready
    function finishLoad() {
      worldReady = true;
      setBar(100);
      setLoadMsg('Shadow Exchange ready.');
      clearTimeout(hardTimeout);
      setTimeout(beginPlay, 150);
    }

    setTimeout(function () {
      try {
        setLoadMsg('Building Jeju Island...');
        buildWorld();
        setLoadMsg('Summoning Sung Jin-Woo...');
        spawnPlayer();
        setLoadMsg('Assembling Korean Raid Party...');
        try { spawnAllies(); } catch (e) { console.warn('allies', e); }
        setLoadMsg('Raising Shadow Army...');
        try { spawnInitialShadows(); } catch (e) { console.warn('shadows', e); }
        setLoadMsg('Ant swarm inbound...');
        try { spawnWave(8); } catch (e) { console.warn('wave', e); }
        finishLoad();
      } catch (err) {
        console.error('[Jeju] World build failed:', err);
        setLoadMsg('Recovering... ' + (err && err.message ? err.message : err));
        try { if (!player) spawnPlayer(); } catch (e2) { console.error(e2); }
        try { if (!vfx && scene) vfx = new VFX(scene); } catch (_) {}
        finishLoad();
      }
    }, 30);

    loadStep();
  }

  function beginPlay() {
    if (Game.mode === 'playing') return; // idempotent
    // Ensure player exists even if spawn failed earlier
    if (!player) {
      try { spawnPlayer(); } catch (e) {
        console.error('[Jeju] Critical: cannot spawn player', e);
        const el = $('loading-text');
        if (el) el.textContent = 'Failed to spawn player: ' + e.message;
        return;
      }
    }
    if (!vfx) {
      try { vfx = new VFX(scene); } catch (_) {}
    }

    const ls = $('loading-screen'); if (ls) ls.classList.add('hidden');
    const hud = $('hud'); if (hud) hud.classList.add('visible');
    Game.mode = 'playing';
    Game.phase = 0;
    Game.time = 0;

    // Snap camera behind player immediately (no lerp lag on start)
    if (camera && player) {
      cameraAngle.yaw = 0;
      cameraAngle.pitch = 0.28;
      const f = new THREE.Vector3(0, 0, 1);
      camera.position.set(
        player.position.x + 0.55,
        player.position.y + 2.6,
        player.position.z + 5.5
      );
      camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z - 2);
      camera.userData._look = new THREE.Vector3(player.position.x, player.position.y + 1.4, player.position.z - 2);
    }

    showStory('CHAPTER — JEJU ISLAND RAID', 'Shadow Exchange', 'Sung Jin-Woo arrives on the forsaken island.');
    setObjective('Reach the Queen\'s Nest — push north through the ant swarm');
    showSystem('NOTICE', 'You have entered an S-Rank Gate.', 'Jeju Island — Final Raid');

    setTimeout(function () {
      const ch = $('controls-help');
      if (ch) ch.classList.add('hide');
    }, 12000);

    // Auto-lock pointer for GoW-style mouse-look
    setTimeout(function () {
      try {
        const c = $('game-canvas');
        if (c && c.requestPointerLock) c.requestPointerLock();
      } catch (_) {}
    }, 500);

    playTone(220, 0.1, 'sine');
    setTimeout(function () { playTone(330, 0.15, 'sine'); }, 100);
    setTimeout(function () { playTone(440, 0.2, 'sine'); }, 200);
  }

  function spawnPlayer() {
    player = Entities.createPlayer();
    player.position.set(0, 0, -15);
    scene.add(player.mesh);
    // Dagger trails
    if (vfx && vfx.trails) {
      const dL = player.mesh.getObjectByName('daggerL');
      const dR = player.mesh.getObjectByName('daggerR');
      if (dL) vfx.trails.attach(dL, { color: 0xa855f7, width: 0.08, maxPoints: 10 });
      if (dR) vfx.trails.attach(dR, { color: 0x7b2fff, width: 0.08, maxPoints: 10 });
    }
  }

  function spawnAllies() {
    const configs = [
      { type: 'cha', pos: [-4, 0, -12] },
      { type: 'baek', pos: [4, 0, -12] },
      { type: 'choi', pos: [-6, 0, -10] },
      { type: 'ma', pos: [6, 0, -10] },
      { type: 'lim', pos: [-2, 0, -8] },
      { type: 'min', pos: [2, 0, -8] },
    ];
    for (const c of configs) {
      const a = Entities.createAlly(c.type);
      a.position.set(c.pos[0], c.pos[1], c.pos[2]);
      scene.add(a.mesh);
      allies.push(a);
    }
    updateAllyHUD();
  }

  function spawnInitialShadows() {
    const types = ['igris', 'iron', 'tank', 'tusk'];
    // Plus generic soldiers
    for (let i = 0; i < 8; i++) types.push('soldier');
    for (let i = 0; i < types.length; i++) {
      const s = Entities.createShadow(types[i], player);
      const a = (i / types.length) * Math.PI * 2;
      s.position.set(
        player.position.x + Math.cos(a) * 5,
        0,
        player.position.z + Math.sin(a) * 5
      );
      scene.add(s.mesh);
      shadows.push(s);
      player.shadowArmy.push(s);
    }
    updateShadowHUD();
    // Arise flash
    vfx.arise(player.position);
  }

  function spawnWave(count) {
    waveNumber++;
    for (let i = 0; i < count; i++) {
      const elite = Math.random() < 0.15 + waveNumber * 0.02;
      const ant = Entities.createAnt(Math.floor(Math.random() * 4), elite);
      // Spawn ahead toward nest or around player
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 25;
      let cx = player.position.x + Math.cos(angle) * dist;
      let cz = player.position.z + Math.sin(angle) * dist + 8;
      // Bias north in early phases
      if (Game.phase < 2) cz = player.position.z + 15 + Math.random() * 30;
      ant.position.set(cx, ant.flying ? 1.2 : 0, cz);
      scene.add(ant.mesh);
      enemies.push(ant);
    }
  }

  function spawnBoss() {
    if (Game.bossSpawned) return;
    Game.bossSpawned = true;
    boss = Entities.createAntKing();
    boss.position.set(0, 0, 95);
    scene.add(boss.mesh);
    enemies.push(boss);

    $('boss-bar').classList.add('visible');
    setLetterbox(true);
    showStory('HIDDEN BOSS', 'THE ANT KING', '"Are there others? Others you call king?"');
    showSystem('WARNING', 'An immense presence has appeared.', 'Hidden Boss — Ant King');
    setObjective('DEFEAT THE ANT KING — Protect the Korean Raid Party');
    playTone(80, 0.4, 'sawtooth');
    setTimeout(() => setLetterbox(false), 3000);

    vfx.shockwaves.spawn(0, 0, 95, { color: 0xff1a2e, speed: 15, maxScale: 20, life: 1.2 });
    vfx.particles.burst(0, 2, 95, 40, { color: 0xff1a2e, speed: 8, size: 0.15, life: 1.0, up: 3 });
  }

  // ═══════════════════════════════════════════
  // COMBAT
  // ═══════════════════════════════════════════
  function doBasicAttack() {
    if (!player || !player.alive || Game.mode !== 'playing') return;
    const now = performance.now();
    if (now - lastAttack < SKILLS.basic.cd * 1000) return;
    lastAttack = now;

    const range = SKILLS.basic.range;
    const origin = player.position.clone();
    const facing = getPlayerFacing();
    let hit = false;
    let crit = player.stealthNextCrit || player.hasBuff('stealth') || Math.random() < 0.25;

    // Clear stealth on attack
    if (player.hasBuff('stealth')) {
      delete player.buffs.stealth;
      player.stealthNextCrit = true;
      crit = true;
    }

    for (const e of enemies) {
      if (!e.alive) continue;
      const toE = new THREE.Vector3().subVectors(e.position, origin);
      const dist = toE.length();
      if (dist > range + e.radius) continue;
      toE.normalize();
      if (toE.dot(facing) < 0.2 && dist > 2) continue; // must face roughly

      let dmg = rand(SKILLS.basic.dmg[0], SKILLS.basic.dmg[1]);
      dmg += player.stats.str * 0.4;
      if (crit) dmg *= 2.2;
      if (player.domainActive) dmg *= 1.15;
      // Combo bonus
      dmg *= 1 + Math.min(player.combo, 20) * 0.03;

      const dealt = e.takeDamage(dmg, player);
      e.knockback.add(facing.clone().multiplyScalar(crit ? 8 : 4));
      showDamage(e.position, Math.floor(dealt), crit ? 'crit' : '');
      vfx.hit(e.position, crit);
      vfx.slash(player.position, facing);
      player.addCombo();
      hit = true;

      if (!e.alive) onEnemyKilled(e);
    }

    if (!hit) {
      vfx.slash(player.position, facing, 0x8866cc);
    } else {
      playTone(crit ? 600 : 400, 0.05, 'square');
    }
    player.stealthNextCrit = false;

    // Animate daggers
    animateDaggerSwing();
  }

  function animateDaggerSwing() {
    const dL = player.mesh.getObjectByName('daggerL');
    const dR = player.mesh.getObjectByName('daggerR');
    if (!dL || !dR) return;
    const t0 = { z: dL.rotation.z, z2: dR.rotation.z };
    const start = performance.now();
    const swing = () => {
      const t = (performance.now() - start) / 180;
      if (t >= 1) {
        dL.rotation.z = 0.4; dR.rotation.z = -0.4;
        return;
      }
      const s = Math.sin(t * Math.PI);
      dL.rotation.z = 0.4 - s * 1.2;
      dR.rotation.z = -0.4 + s * 1.2;
      requestAnimationFrame(swing);
    };
    swing();
  }

  function trySkill(key) {
    if (!player || !player.alive || Game.mode !== 'playing') return;
    if (!player.canUse(key)) {
      if (player.skillCd[key] > 0) return;
      if (SKILLS[key] && player.mp < SKILLS[key].mp) {
        showSystem('SYSTEM', 'Not enough mana.', '');
      }
      return;
    }
    const skill = SKILLS[key];
    player.useMp(skill.mp);
    player.skillCd[key] = skill.cd;

    const facing = getPlayerFacing();
    const origin = player.position.clone();

    switch (key) {
      case 'mutilation': {
        vfx.mutilation(origin);
        playTone(500, 0.08, 'sawtooth');
        const hits = skill.hits;
        let i = 0;
        const doHit = () => {
          if (i >= hits) return;
          i++;
          for (const e of enemies) {
            if (!e.alive) continue;
            if (e.distanceTo(player) > skill.range + e.radius) continue;
            let dmg = rand(skill.dmg[0], skill.dmg[1]);
            if (player.domainActive) dmg *= 1.15;
            const dealt = e.takeDamage(dmg, player);
            e.knockback.add(facing.clone().multiplyScalar(2));
            showDamage(e.position, Math.floor(dealt), 'skill');
            player.addCombo();
            if (!e.alive) onEnemyKilled(e);
          }
          setTimeout(doHit, 50);
        };
        doHit();
        showKillFeed('Sung Jin-Woo', 'Mutilation');
        break;
      }
      case 'daggerRush': {
        const targets = [];
        const hitEnemies = [];
        for (const e of enemies) {
          if (!e.alive) continue;
          if (e.distanceTo(player) > skill.range) continue;
          targets.push(e.position.clone().add(new THREE.Vector3(0, 1, 0)));
          hitEnemies.push(e);
          if (targets.length >= 8) break;
        }
        if (targets.length === 0) {
          // Fire forward
          const t = origin.clone().add(facing.clone().multiplyScalar(10).setY(1));
          targets.push(t);
        }
        vfx.daggerRush(origin.clone().setY(1.2), targets);
        playTone(700, 0.06, 'square');
        for (const e of hitEnemies) {
          for (let h = 0; h < skill.hits; h++) {
            setTimeout(() => {
              if (!e.alive) return;
              let dmg = rand(skill.dmg[0], skill.dmg[1]);
              const dealt = e.takeDamage(dmg, player);
              showDamage(e.position, Math.floor(dealt), 'skill');
              player.addCombo();
              if (!e.alive) onEnemyKilled(e);
            }, h * 60);
          }
        }
        showKillFeed('Sung Jin-Woo', 'Dagger Rush');
        break;
      }
      case 'bloodlust': {
        vfx.bloodlust(origin);
        playTone(120, 0.3, 'sawtooth');
        for (const e of enemies) {
          if (!e.alive) continue;
          if (e.distanceTo(player) > skill.range) continue;
          e.applyDebuff('bloodlust', skill.duration);
        }
        showKillFeed('Sung Jin-Woo', 'Bloodlust — Enemy stats -50%');
        showSystem('SKILL', 'Bloodlust activated.', 'Fear grips your enemies.');
        break;
      }
      case 'rulersAuthority': {
        // Find target enemy in crosshair / nearest in range
        let target = findAimTarget(skill.range) || findNearestEnemy(skill.range);
        if (!target) {
          // Slam forward
          const slamPos = origin.clone().add(facing.clone().multiplyScalar(8));
          vfx.rulersAuthority(origin.clone().setY(1.5), slamPos.clone().setY(0.5));
          for (const e of enemies) {
            if (!e.alive) continue;
            if (e.position.distanceTo(slamPos) < 4) {
              let dmg = rand(skill.dmg[0], skill.dmg[1]);
              const dealt = e.takeDamage(dmg, player);
              e.knockback.set(0, 0, 0);
              e.position.y = 0;
              showDamage(e.position, Math.floor(dealt), 'skill');
              if (!e.alive) onEnemyKilled(e);
            }
          }
        } else {
          const tp = target.position.clone().setY(1);
          vfx.rulersAuthority(origin.clone().setY(1.5), tp);
          // Lift and slam
          target.position.y = 3;
          setTimeout(() => {
            if (!target.alive) return;
            target.position.y = 0;
            let dmg = rand(skill.dmg[0], skill.dmg[1]);
            const dealt = target.takeDamage(dmg, player);
            vfx.shockwaves.spawn(target.position.x, 0, target.position.z, { color: 0x5ee7ff, speed: 12, maxScale: 5 });
            showDamage(target.position, Math.floor(dealt), 'crit');
            player.addCombo();
            if (!target.alive) onEnemyKilled(target);
          }, 350);
        }
        playTone(300, 0.15, 'sine');
        showKillFeed('Sung Jin-Woo', "Ruler's Authority");
        break;
      }
      case 'monarchDomain': {
        vfx.monarchDomain(origin);
        player.domainActive = true;
        Game.domainTimer = skill.duration;
        player.applyBuff('domain', skill.duration);
        playTone(180, 0.4, 'sine');
        setTimeout(() => playTone(240, 0.3, 'sine'), 150);
        showSystem('JOB SKILL', "Monarch's Domain", 'Shadow soldiers power +50%');
        showKillFeed('Sung Jin-Woo', "Monarch's Domain");
        break;
      }
      case 'quicksilver': {
        player.applyBuff('quicksilver', skill.duration);
        vfx.particles.burst(origin.x, origin.y + 1, origin.z, 15, { color: 0x5ee7ff, speed: 4, size: 0.08, life: 0.4 });
        showKillFeed('Sung Jin-Woo', 'Quicksilver — Speed +30%');
        playTone(800, 0.08, 'sine');
        break;
      }
      case 'stealth': {
        player.applyBuff('stealth', skill.duration);
        vfx.particles.burst(origin.x, origin.y + 1, origin.z, 20, { color: 0x334466, speed: 2, size: 0.08, life: 0.5 });
        showKillFeed('Sung Jin-Woo', 'Stealth');
        break;
      }
      case 'shadowExchange': {
        // Teleport forward or to nearest shadow
        let dest = origin.clone().add(facing.clone().multiplyScalar(12));
        // Or to a shadow near enemies
        if (shadows.length) {
          let best = null, bestScore = -Infinity;
          for (const s of shadows) {
            if (!s.alive) continue;
            // Prefer shadows near enemies / forward
            let score = 0;
            for (const e of enemies) {
              if (e.alive) score += Math.max(0, 15 - s.distanceTo(e));
            }
            const forward = s.position.clone().sub(origin).normalize().dot(facing);
            score += forward * 5;
            if (score > bestScore) { bestScore = score; best = s; }
          }
          if (best && bestScore > 2) dest = best.position.clone();
        }
        vfx.shadowExchange(origin);
        player.position.copy(dest);
        player.position.y = 0;
        vfx.shadowExchange(dest);
        // Damage on arrival
        for (const e of enemies) {
          if (!e.alive) continue;
          if (e.position.distanceTo(dest) < 4) {
            let dmg = rand(skill.dmg[0], skill.dmg[1]);
            const dealt = e.takeDamage(dmg, player);
            showDamage(e.position, Math.floor(dealt), 'shadow');
            if (!e.alive) onEnemyKilled(e);
          }
        }
        playTone(250, 0.1, 'triangle');
        showKillFeed('Sung Jin-Woo', 'Shadow Exchange');
        break;
      }
      case 'arise': {
        // Extract nearby dead extractable enemies
        let extracted = 0;
        for (const e of enemies) {
          if (e.alive || e.extracted || !e.extractable) continue;
          if (e.position.distanceTo(player.position) > 20) continue;
          e.extracted = true;
          extracted++;
          Game.extracted++;

          if (e === boss || e.name === 'Ant King') {
            // BERU
            extractBeru(e);
          } else {
            // Generic shadow ant
            const s = Entities.createShadow('soldier', player);
            s.position.copy(e.position);
            s.name = 'Shadow Ant';
            s.damage = 70;
            s.hp = s.maxHp = 900;
            scene.add(s.mesh);
            shadows.push(s);
            player.shadowArmy.push(s);
            vfx.arise(e.position);
            // Remove corpse mesh fade
            if (e.mesh.parent) {
              e.mesh.visible = false;
            }
          }
        }
        if (extracted > 0) {
          showSystem('JOB SKILL', 'ARISE', `${extracted} shadow soldier(s) extracted`);
          updateShadowHUD();
          playTone(200, 0.2, 'sine');
          setTimeout(() => playTone(400, 0.3, 'sine'), 200);
        } else {
          showSystem('SYSTEM', 'No extractable shadows nearby.', 'Defeat enemies first.');
          // Refund CD partially
          player.skillCd.arise = 0.5;
        }
        break;
      }
    }
    updateSkillHUD();
  }

  function extractBeru(e) {
    Game.beruExtracted = true;
    setLetterbox(true);
    $('arise-overlay').classList.add('active');
    playTone(150, 0.5, 'sine');

    setTimeout(() => {
      $('arise-overlay').classList.remove('active');
      const beru = Entities.createShadow('beru', player);
      beru.position.copy(e.position);
      scene.add(beru.mesh);
      shadows.push(beru);
      player.shadowArmy.push(beru);
      vfx.arise(e.position);
      vfx.monarchDomain(e.position);
      if (e.mesh.parent) e.mesh.visible = false;
      updateShadowHUD();
      showSystem('SHADOW EXTRACTION', 'Beru — Marshal Grade', 'The Ant King kneels to the Shadow Monarch.');
      showStory('SHADOW ARMY', 'BERU JOINS THE LEGION', 'Annihilate the remaining ants.');
      setObjective('Clear remaining ants — Secure Jeju Island');
      setTimeout(() => {
        setLetterbox(false);
        // Victory after short cleanup
        setTimeout(() => checkVictory(true), 8000);
      }, 2500);
    }, 2800);
  }

  function onEnemyKilled(e) {
    Game.kills++;
    player.kills++;
    player.xp += e.xpValue;
    vfx.death(e.position, false);
    showKillFeed(player.name, e.name);
    addKillFeedItem(e.name);

    if (e === boss || e.name === 'Ant King') {
      Game.bossDefeated = true;
      $('boss-bar').classList.remove('visible');
      showStory('BOSS DEFEATED', 'THE ANT KING HAS FALLEN', 'Press F near the corpse — ARISE');
      setObjective('Extract the Ant King\'s shadow — Press [F] ARISE');
      showSystem('QUEST COMPLETE', 'Ant King Defeated', 'Shadow Extraction available');
      // Heal Cha if downed story beat
      const cha = allies.find(a => a.name.includes('Cha'));
      if (cha && cha.hp < cha.maxHp * 0.3) {
        const min = allies.find(a => a.name.includes('Min'));
        if (min) {
          setTimeout(() => {
            showStory('', 'Min Byung-Gyu\'s Shadow', 'Temporary extraction — heal Cha Hae-In');
            cha.heal(2000);
            vfx.healPulse(cha.position);
            showDamage(cha.position, 2000, 'heal');
          }, 2000);
        }
      }
      playTone(100, 0.5, 'sawtooth');
    }

    // Phase progression by kills / position
    checkPhase();
  }

  function checkPhase() {
    if (Game.phase === 0 && (Game.kills >= 8 || player.position.z > 20)) {
      Game.phase = 1;
      setObjective('Push into the Nest — Eliminate the ant swarm');
      showStory('PHASE II', 'INTO THE NEST', 'The Korean hunters fight beside you.');
      spawnWave(15);
    }
    if (Game.phase === 1 && (Game.kills >= 25 || player.position.z > 55)) {
      Game.phase = 2;
      setObjective('Enter the Queen\'s Chamber — North');
      showStory('PHASE III', "QUEEN'S CHAMBER", 'The Ant Queen lies dead. Something worse remains...');
      spawnWave(10);
    }
    if (Game.phase === 2 && player.position.z > 78 && !Game.bossSpawned) {
      Game.phase = 3;
      spawnBoss();
      // Story: hunters are wounded
      for (const a of allies) {
        if (a.name.includes('Min')) continue;
        a.hp = Math.max(a.maxHp * 0.25, a.hp * 0.4);
      }
      updateAllyHUD();
    }
  }

  function checkVictory(force) {
    if (Game.mode !== 'playing') return;
    if (!Game.bossDefeated) return;
    if (!force && !Game.beruExtracted) return;
    // Win
    Game.mode = 'victory';
    $('victory-screen').classList.remove('hidden');
    $('hud').classList.remove('visible');
    $('victory-stats').innerHTML = `
      <div>Ant King Defeated</div>
      <div>Enemies Slain: <b>${Game.kills}</b></div>
      <div>Shadows Extracted: <b>${Game.extracted}</b></div>
      <div>Shadow Army: <b>${shadows.filter(s => s.alive || s.immortal).length}</b></div>
      <div style="margin-top:12px;color:var(--purple-glow)">Beru — Marshal Grade Acquired</div>
      <div style="color:var(--muted);margin-top:8px;font-size:13px">Jeju Island S-Rank Gate — CLEARED</div>
    `;
    document.exitPointerLock?.();
  }

  function triggerDefeat() {
    Game.mode = 'defeat';
    $('defeat-screen').classList.remove('hidden');
    $('hud').classList.remove('visible');
    document.exitPointerLock?.();
  }

  // ═══════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════
  function getPlayerFacing() {
    // Camera yaw drives facing (God of War / character-action style)
    const dir = new THREE.Vector3(
      -Math.sin(cameraAngle.yaw),
      0,
      -Math.cos(cameraAngle.yaw)
    );
    return dir.normalize();
  }

  function findNearestEnemy(range) {
    let best = null, bestD = range;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = e.distanceTo(player);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function findAimTarget(range) {
    // Closest to center of view
    let best = null, bestScore = Infinity;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = e.distanceTo(player);
      if (d > range) continue;
      const toE = e.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(camera.position).normalize();
      const ang = 1 - toE.dot(camDir);
      if (ang < bestScore && ang < 0.3) { bestScore = ang; best = e; }
    }
    return best;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function clampWorld(ent) {
    ent.position.x = Math.max(worldBounds.minX, Math.min(worldBounds.maxX, ent.position.x));
    ent.position.z = Math.max(worldBounds.minZ, Math.min(worldBounds.maxZ, ent.position.z));
  }

  // ═══════════════════════════════════════════
  // UI
  // ═══════════════════════════════════════════
  function showDamage(pos, amount, type = '') {
    const v = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.5 + Math.random() * 0.5, 0));
    v.project(camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return;
    const el = document.createElement('div');
    el.className = 'dmg-num ' + type;
    el.textContent = (type === 'heal' ? '+' : '') + amount;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    $('dmg-layer').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function showKillFeed(who, what) {
    // combo display uses this lightly
  }

  function addKillFeedItem(name) {
    const feed = $('kill-feed');
    if (!feed) return;
    const el = document.createElement('div');
    el.className = 'kill-item' + (name.includes('King') ? ' boss' : '');
    el.innerHTML = `<b>Jin-Woo</b> defeated <b>${name}</b>`;
    feed.prepend(el);
    while (feed.children.length > 5) feed.lastChild.remove();
    setTimeout(() => el.remove(), 4000);
  }

  function showStory(chapter, line, sub) {
    const b = $('story-banner');
    if (!b) return;
    b.querySelector('.chapter').textContent = chapter;
    b.querySelector('.line').textContent = line;
    b.querySelector('.sub').textContent = sub || '';
    b.classList.add('show');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('show'), 4000);
  }

  function setObjective(text) {
    Game.objective = text;
    const o = $('objective');
    if (!o) return;
    o.textContent = '▸ ' + text;
    o.classList.add('show');
  }

  function showSystem(label, body, sub) {
    const s = $('system-msg');
    if (!s) return;
    s.querySelector('.sys-label').textContent = '— ' + label + ' —';
    s.querySelector('.sys-body').textContent = body;
    s.querySelector('.sys-sub').textContent = sub || '';
    s.classList.add('show');
    clearTimeout(s._t);
    s._t = setTimeout(() => s.classList.remove('show'), 2800);
  }

  function setLetterbox(on) {
    $('letterbox')?.classList.toggle('active', on);
  }

  function setPaused(on) {
    if (on) {
      Game.mode = 'paused';
      $('overlay-menu').classList.add('open');
      document.exitPointerLock?.();
    } else {
      Game.mode = 'playing';
      $('overlay-menu').classList.remove('open');
    }
  }

  function updateHUDFixed(dt) {
    if (!player) return;
    const hpPct = (player.hp / player.maxHp) * 100;
    const mpPct = (player.mp / player.maxMp) * 100;
    const hpFill = $('hp-fill'); const mpFill = $('mp-fill');
    if (hpFill) hpFill.style.width = hpPct + '%';
    if (mpFill) mpFill.style.width = mpPct + '%';
    const hpNum = $('hp-num'); const mpNum = $('mp-num');
    if (hpNum) hpNum.textContent = Math.ceil(player.hp);
    if (mpNum) mpNum.textContent = Math.ceil(player.mp);
    const ln = $('level-num'); if (ln) ln.textContent = 'Lv. ' + player.level;
    const kc = $('kill-count'); if (kc) kc.textContent = Game.kills;
    const sc = $('shadow-count'); if (sc) sc.textContent = shadows.filter(s => s.alive).length;
    const pl = $('phase-label'); if (pl) pl.textContent = ['Beach Assault', 'Nest Push', "Queen's Chamber", 'Ant King', 'Aftermath'][Game.phase] || '';

    const combo = $('combo-display');
    if (combo) {
      if (player.combo >= 3) {
        combo.classList.add('show');
        combo.querySelector('.count').textContent = player.combo;
      } else combo.classList.remove('show');
    }
    $('low-hp')?.classList.toggle('on', player.hp < player.maxHp * 0.3 && player.alive);
    updateSkillHUD();

    if (boss && (boss.alive || Game.bossSpawned)) {
      const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
      const bf = $('boss-fill'); if (bf) bf.style.width = pct + '%';
      const bt = $('boss-hp-text'); if (bt) bt.textContent = Math.ceil(Math.max(0, boss.hp)).toLocaleString() + ' / ' + boss.maxHp.toLocaleString();
      document.querySelectorAll('.boss-phase-pips span').forEach((el, i) => {
        el.classList.toggle('active', boss.phase === i + 1);
        el.classList.toggle('done', boss.phase > i + 1);
      });
    }
    if (Game.domainTimer > 0) {
      Game.domainTimer -= dt;
      if (Game.domainTimer <= 0) player.domainActive = false;
    }
  }

  function updateSkillHUD() {
    if (!player) return;
    document.querySelectorAll('.skill-slot').forEach(el => {
      const key = el.dataset.skill;
      if (!key || !SKILLS[key]) return;
      const cd = player.skillCd[key] || 0;
      const overlay = el.querySelector('.cd-overlay');
      if (cd > 0) {
        el.classList.add('on-cd');
        if (overlay) overlay.textContent = cd.toFixed(1);
      } else {
        el.classList.remove('on-cd');
        if (overlay) overlay.textContent = '';
      }
      // MP gate visual
      el.style.opacity = player.mp < SKILLS[key].mp ? '0.5' : '1';
    });
  }

  function updateShadowHUD() {
    const list = $('shadow-list');
    if (!list) return;
    const counts = {};
    for (const s of shadows) {
      const n = s.name;
      if (!counts[n]) counts[n] = { alive: 0, total: 0, grade: s.grade };
      counts[n].total++;
      if (s.alive) counts[n].alive++;
    }
    list.innerHTML = '';
    // Priority order
    const order = ['Beru', 'Igris', 'Tusk', 'Iron', 'Tank', 'Shadow Soldier', 'Shadow Ant'];
    const keys = Object.keys(counts).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    for (const name of keys) {
      const c = counts[name];
      const row = document.createElement('div');
      row.className = 'shadow-row';
      row.innerHTML = `<span class="rank">${(c.grade || '').slice(0, 3).toUpperCase()}</span><span class="sname">${name}</span><span class="scount">${c.alive}/${c.total}</span>`;
      list.appendChild(row);
    }
  }

  function updateAllyHUD() {
    const panel = $('ally-list');
    if (!panel) return;
    panel.innerHTML = '';
    for (const a of allies) {
      const row = document.createElement('div');
      row.className = 'ally-row';
      const pct = a.alive ? (a.hp / a.maxHp) * 100 : 0;
      const status = !a.alive ? 'down' : (a.hp < a.maxHp * 0.35 ? 'busy' : '');
      row.innerHTML = `<span class="ally-dot ${status}"></span><span class="ally-name">${a.name}</span><span class="ally-hp"><i style="width:${pct}%"></i></span>`;
      panel.appendChild(row);
    }
  }

  function updateMinimap() {
    if (!minimapCtx || !player) return;
    const c = $('minimap-canvas');
    const w = c.width = 140;
    const h = c.height = 140;
    const ctx = minimapCtx;
    ctx.fillStyle = 'rgba(5,8,16,0.9)';
    ctx.fillRect(0, 0, w, h);

    const scale = 0.7;
    const cx = w / 2, cy = h / 2;
    const px = player.position.x, pz = player.position.z;

    const toM = (x, z) => [
      cx + (x - px) * scale,
      cy + (z - pz) * scale * 0.85, // slight compress
    ];

    // Nest marker
    ctx.fillStyle = 'rgba(255,45,85,0.4)';
    let [nx, ny] = toM(0, 95);
    ctx.beginPath(); ctx.arc(nx, ny, 8, 0, Math.PI * 2); ctx.fill();

    // Enemies
    ctx.fillStyle = '#ff2d55';
    for (const e of enemies) {
      if (!e.alive) continue;
      const [x, y] = toM(e.position.x, e.position.z);
      if (x < 0 || y < 0 || x > w || y > h) continue;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Shadows
    ctx.fillStyle = '#a855f7';
    for (const s of shadows) {
      if (!s.alive) continue;
      const [x, y] = toM(s.position.x, s.position.z);
      if (x < 2 || y < 2 || x > w - 2 || y > h - 2) continue;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Allies
    ctx.fillStyle = '#3dff9a';
    for (const a of allies) {
      if (!a.alive) continue;
      const [x, y] = toM(a.position.x, a.position.z);
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player
    ctx.fillStyle = '#f5c542';
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    // Facing
    ctx.strokeStyle = '#f5c542';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - Math.sin(cameraAngle.yaw) * 10, cy - Math.cos(cameraAngle.yaw) * 10);
    ctx.stroke();

    // Border grid
    ctx.strokeStyle = 'rgba(123,47,255,0.2)';
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  // ═══════════════════════════════════════════
  // AUDIO (procedural SFX)
  // ═══════════════════════════════════════════
  function playTone(freq, dur, type = 'square') {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = 0.04;
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (_) {}
  }

  // ═══════════════════════════════════════════
  // PLAYER MOVEMENT
  // ═══════════════════════════════════════════
  function updatePlayer(dt) {
    if (!player.alive) {
      player.animate(dt);
      if (!Game._defeatTriggered) {
        Game._defeatTriggered = true;
        setTimeout(triggerDefeat, 1500);
      }
      return;
    }

    const facing = getPlayerFacing();
    const right = new THREE.Vector3().crossVectors(facing, new THREE.Vector3(0, 1, 0)).normalize();
    let mx = 0, mz = 0;

    if (keys['KeyW'] || keys['ArrowUp']) { mx += facing.x; mz += facing.z; }
    if (keys['KeyS'] || keys['ArrowDown']) { mx -= facing.x; mz -= facing.z; }
    if (keys['KeyA'] || keys['ArrowLeft']) { mx -= right.x; mz -= right.z; }
    if (keys['KeyD'] || keys['ArrowRight']) { mx += right.x; mz += right.z; }

    // Touch
    if (window._touchMove) {
      const tx = window._touchMove.x, ty = window._touchMove.y;
      if (Math.abs(tx) + Math.abs(ty) > 0.1) {
        mx += facing.x * -ty + right.x * tx;
        mz += facing.z * -ty + right.z * tx;
      }
    }

    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len; mz /= len;
      player.state = 'move';
      player.position.x += mx * player.moveSpeed * dt;
      player.position.z += mz * player.moveSpeed * dt;
      player.mesh.rotation.y = Math.atan2(mx, mz);
      player.facing.set(mx, 0, mz);
    } else {
      player.state = 'idle';
    }

    player.position.y = 0;
    clampWorld(player);
    player.update(dt);

    // Continuous attack if held
    if (mouse.down) doBasicAttack();

    // Shadow aura VFX
    vfx.shadowAura(player.position, dt);

    // Interact prompt for arise near corpses
    let nearCorpse = false;
    for (const e of enemies) {
      if (e.alive || e.extracted || !e.extractable) continue;
      if (e.distanceTo(player) < 8) { nearCorpse = true; break; }
    }
    const ip = $('interact-prompt');
    if (ip) {
      if (nearCorpse) {
        ip.innerHTML = '<kbd>F</kbd> ARISE — Extract Shadow';
        ip.classList.add('show');
      } else ip.classList.remove('show');
    }
  }

  function updateCamera(dt) {
    if (!player) return;

    // ── God of War–style cinematic 3rd person ──
    // Camera sits over the right shoulder, locked behind the character,
    // looks slightly ahead of the player for combat readability.
    const yaw = cameraAngle.yaw;
    const pitch = cameraAngle.pitch;
    const dist = cameraAngle.dist;
    const shoulder = cameraAngle.shoulder;

    // Forward / right on XZ from yaw
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    // Pivot at upper chest
    const pivot = player.position.clone();
    pivot.y += cameraAngle.lookHeight;

    // Desired camera position: behind + up + shoulder offset
    const behind = forward.clone().multiplyScalar(-dist * Math.cos(pitch));
    const up = new THREE.Vector3(0, dist * Math.sin(pitch) + 1.15, 0);
    const side = right.clone().multiplyScalar(shoulder);
    const desired = pivot.clone().add(behind).add(up).add(side);

    // Smooth follow (snappy in combat)
    const lerpT = 1 - Math.pow(0.0008, dt);
    camera.position.lerp(desired, lerpT);

    // Look point slightly ahead of player (cinematic framing)
    const lookAt = pivot.clone().add(forward.clone().multiplyScalar(2.8));
    lookAt.y += 0.15 - pitch * 0.3;

    // Soft look (avoid jitter)
    if (!camera.userData._look) camera.userData._look = lookAt.clone();
    camera.userData._look.lerp(lookAt, 1 - Math.pow(0.0005, dt));
    camera.lookAt(camera.userData._look);

    // Keep FOV cinematic
    if (Math.abs(camera.fov - cameraAngle.fov) > 0.1) {
      camera.fov = cameraAngle.fov;
      camera.updateProjectionMatrix();
    }

    // Rim light follows player
    if (Game._rimLight) {
      Game._rimLight.position.set(
        player.position.x - forward.x * 4,
        10,
        player.position.z - forward.z * 4
      );
    }
  }

  // ═══════════════════════════════════════════
  // AI UPDATE
  // ═══════════════════════════════════════════
  function updateEntities(dt) {
    const domainBuff = player.domainActive;
    const allAllies = [...allies, ...shadows.filter(s => s.alive)];

    // Enemies
    for (const e of enemies) {
      if (e === boss) continue;
      if (!e.alive) {
        e.animate(dt);
        continue;
      }
      const action = e.updateAI(dt, player, allAllies);
      clampWorld(e);
      if (action && action.type === 'attack' && action.target) {
        const dealt = action.target.takeDamage(action.damage, e);
        if (dealt > 0) {
          vfx.hit(action.target.position, false);
          if (action.target === player) {
            $('hit-vignette').style.opacity = '1';
            setTimeout(() => { $('hit-vignette').style.opacity = '0'; }, 120);
            playTone(150, 0.08, 'square');
            showDamage(player.position, Math.floor(dealt), '');
          }
        }
      }
    }

    // Boss
    if (boss) {
      const action = boss.updateAI(dt, player, null);
      if (boss.alive) {
        vfx.bossAura(boss.position);
        clampWorld(boss);
      }
      if (action) {
        handleBossAction(action);
      }
    }

    // Shadows
    for (const s of shadows) {
      const action = s.updateAI(dt, player, enemies, domainBuff);
      clampWorld(s);
      if (action) {
        if (action.type === 'attack' || action.type === 'magic') {
          const dealt = action.target.takeDamage(action.damage, s);
          showDamage(action.target.position, Math.floor(dealt), 'shadow');
          if (action.type === 'magic') {
            vfx.particles.burst(action.target.position.x, 1, action.target.position.z, 10, {
              color: 0xa855f7, speed: 3, size: 0.08, life: 0.4,
            });
          } else {
            vfx.hit(action.target.position, false);
          }
          if (!action.target.alive) onEnemyKilled(action.target);
        }
      }
    }

    // Allies
    for (const a of allies) {
      // Pass full ally list for healer
      const action = a.updateAI(dt, player, enemies);
      clampWorld(a);
      if (!action) continue;

      if (action.type === 'attack' || action.type === 'swordlight' || action.type === 'fire' || action.type === 'arrow') {
        const dealt = action.target.takeDamage(action.damage, a);
        showDamage(action.target.position, Math.floor(dealt), action.type === 'fire' ? 'skill' : '');
        if (action.type === 'fire') {
          vfx.fireMagic(a.position.clone().setY(1.2), action.target.position.clone().setY(1));
        } else if (action.type === 'swordlight') {
          vfx.swordLight(a.position, new THREE.Vector3().subVectors(action.target.position, a.position).normalize());
        } else if (action.type === 'arrow') {
          vfx.beams.spawn(a.position.clone().setY(1.2), action.target.position.clone().setY(1), { color: 0x3dff9a, radius: 0.04, life: 0.2 });
        } else {
          vfx.hit(action.target.position, false);
        }
        if (!action.target.alive) onEnemyKilled(action.target);
      }
      if (action.type === 'heal') {
        const healed = action.target.heal(action.amount);
        vfx.healPulse(action.target.position);
        showDamage(action.target.position, Math.floor(healed), 'heal');
      }
    }

    // Healer also heals allies
    const healer = allies.find(a => a.role === 'healer' && a.alive);
    if (healer && healer.specialCd <= 0) {
      let lowest = null, lowestPct = 0.75;
      for (const a of [...allies, player]) {
        if (!a.alive) continue;
        const pct = a.hp / a.maxHp;
        if (pct < lowestPct) { lowestPct = pct; lowest = a; }
      }
      if (lowest) {
        healer.specialCd = 5;
        const healed = lowest.heal(350);
        vfx.healPulse(lowest.position);
        showDamage(lowest.position, Math.floor(healed), 'heal');
      }
    }

    // Periodic ally HUD
    if (Math.floor(Game.time * 2) !== Math.floor((Game.time - dt) * 2)) {
      updateAllyHUD();
      updateShadowHUD();
    }
  }

  function handleBossAction(action) {
    if (!action) return;
    if (action.type === 'phase') {
      showStory('PHASE ' + (action.phase === 2 ? 'II' : 'III'), action.phase === 2 ? 'ENRAGED' : 'DESPERATION', action.phase === 2 ? 'The Ant King grows more ferocious!' : 'Ice. Poison. Gluttony.');
      vfx.shockwaves.spawn(boss.position.x, 0, boss.position.z, { color: 0xff1a2e, speed: 18, maxScale: 12 });
      playTone(60, 0.4, 'sawtooth');
      return;
    }
    if (action.type === 'slash' && action.target) {
      const dealt = action.target.takeDamage(action.damage, boss);
      vfx.slash(boss.position, new THREE.Vector3().subVectors(action.target.position, boss.position).normalize(), 0xff1a2e);
      if (action.target === player && dealt > 0) {
        $('hit-vignette').style.opacity = '1';
        setTimeout(() => { $('hit-vignette').style.opacity = '0'; }, 150);
        showDamage(player.position, Math.floor(dealt), 'crit');
        player.knockback.add(new THREE.Vector3().subVectors(player.position, boss.position).setY(0).normalize().multiplyScalar(12));
      }
      playTone(100, 0.1, 'sawtooth');
    }
    if (action.type === 'poison' && action.target) {
      vfx.poisonSpit(boss.position.clone().setY(2), action.target.position.clone().setY(1));
      // Jinwoo has detoxification — reduced poison
      let dmg = action.damage;
      if (action.target === player) dmg *= 0.15; // Longevity / detox
      const dealt = action.target.takeDamage(dmg, boss);
      showDamage(action.target.position, Math.floor(dealt), '');
      if (action.target === player) showSystem('PASSIVE', 'Detoxification', 'Poison neutralized');
    }
    if (action.type === 'smash') {
      boss.mesh.scale.setScalar(1.6);
      setTimeout(() => boss.mesh.scale.setScalar(1.4), 400);
      vfx.shockwaves.spawn(boss.position.x, 0, boss.position.z, { color: 0xff1a2e, speed: 14, maxScale: 8 });
      for (const t of [player, ...allies, ...shadows]) {
        if (!t.alive) continue;
        if (t.distanceTo(boss) < action.range) {
          const dealt = t.takeDamage(action.damage, boss);
          if (t === player) showDamage(player.position, Math.floor(dealt), 'crit');
        }
      }
    }
    if (action.type === 'ice') {
      vfx.iceBlast(boss.position);
      for (const t of [player, ...allies]) {
        if (!t.alive) continue;
        if (t.distanceTo(boss) < action.range) {
          t.takeDamage(action.damage, boss);
        }
      }
    }
    if (action.type === 'dive' && action.target) {
      // Dash toward player
      const dir = new THREE.Vector3().subVectors(action.target.position, boss.position).setY(0).normalize();
      boss.position.addScaledVector(dir, 8);
      vfx.particles.burst(boss.position.x, 1, boss.position.z, 20, { color: 0xff1a2e, speed: 5, size: 0.1, life: 0.4 });
      if (boss.distanceTo(action.target) < 4) {
        action.target.takeDamage(action.damage, boss);
        vfx.hit(action.target.position, true);
      }
    }
    if (action.type === 'heal_self') {
      boss.heal(action.amount);
      vfx.healPulse(boss.position);
      showDamage(boss.position, action.amount, 'heal');
      showStory('', 'GLUTTONY', 'The Ant King regenerates — absorbed healer magic!');
    }
  }

  // ═══════════════════════════════════════════
  // SPAWN MANAGEMENT
  // ═══════════════════════════════════════════
  function updateSpawns(dt) {
    spawnTimer -= dt;
    const aliveEnemies = enemies.filter(e => e.alive && e !== boss).length;

    if (Game.phase < 3 && spawnTimer <= 0 && aliveEnemies < 20) {
      spawnTimer = Game.phase === 0 ? 8 : Game.phase === 1 ? 6 : 10;
      spawnWave(Game.phase === 0 ? 6 : Game.phase === 1 ? 8 : 5);
    }

    // After boss, spawn residual ants
    if (Game.bossDefeated && Game.beruExtracted && aliveEnemies < 8 && spawnTimer <= 0) {
      spawnTimer = 5;
      spawnWave(4);
    }

    // Cleanup far dead meshes eventually
    if (enemies.length > 80) {
      enemies = enemies.filter(e => {
        if (!e.alive && e.extracted) {
          scene.remove(e.mesh);
          return false;
        }
        if (!e.alive && e.distanceTo(player) > 60) {
          scene.remove(e.mesh);
          return false;
        }
        return true;
      });
    }
  }

  // ═══════════════════════════════════════════
  // MAIN LOOP
  // ═══════════════════════════════════════════
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (Game.mode === 'playing') {
      Game.time += dt;
      updatePlayer(dt);
      updateEntities(dt);
      updateSpawns(dt);
      updateCamera(dt);
      updateHUDFixed(dt);
      updateMinimap();
      checkPhase();
      if (vfx) vfx.update(dt);
    } else if (Game.mode === 'cinematic') {
      if (player) updateCamera(dt);
      if (vfx) vfx.update(dt);
    } else if (Game.mode === 'loading') {
      // Don't update camera until player exists
      if (player) updateCamera(dt);
    } else if (player && (Game.mode === 'paused' || Game.mode === 'victory' || Game.mode === 'defeat')) {
      updateCamera(dt);
      if (vfx) vfx.update(dt);
    }

    // Always render if scene exists
    if (renderer && scene && camera) {
      // Idle animations on title? skip
      renderer.render(scene, camera);
    }
  }

  // Boot — run after DOM is ready
  function boot() {
    try {
      init();
    } catch (e) {
      console.error('[Jeju] boot crash', e);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
