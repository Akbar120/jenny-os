/**
 * JEJU ISLAND RAID — Top-tier VFX System
 * Particles, trails, shockwaves, skill effects
 */
(function (global) {
  'use strict';
  const THREE = global.THREE;

  class ParticlePool {
    constructor(scene, count = 400) {
      this.scene = scene;
      this.particles = [];
      this.geo = new THREE.SphereGeometry(1, 4, 4);
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const m = new THREE.Mesh(this.geo, mat);
        m.visible = false;
        m.userData = { alive: false, life: 0, maxLife: 1, vel: new THREE.Vector3(), drag: 0.98, gravity: 0, spin: 0 };
        scene.add(m);
        this.particles.push(m);
      }
      this.idx = 0;
    }

    spawn(x, y, z, opts = {}) {
      const p = this.particles[this.idx];
      this.idx = (this.idx + 1) % this.particles.length;
      p.visible = true;
      p.position.set(x, y, z);
      p.material.color.set(opts.color ?? 0xffffff);
      p.material.opacity = opts.opacity ?? 1;
      const s = opts.size ?? 0.08;
      p.scale.setScalar(s);
      p.userData.alive = true;
      p.userData.life = opts.life ?? 0.6;
      p.userData.maxLife = p.userData.life;
      p.userData.vel.set(
        (opts.vx ?? 0) + (Math.random() - 0.5) * (opts.spread ?? 0.5),
        (opts.vy ?? 0) + (Math.random() - 0.5) * (opts.spread ?? 0.5),
        (opts.vz ?? 0) + (Math.random() - 0.5) * (opts.spread ?? 0.5)
      );
      p.userData.drag = opts.drag ?? 0.96;
      p.userData.gravity = opts.gravity ?? 0;
      p.userData.spin = opts.spin ?? 0;
      p.userData.fade = opts.fade !== false;
      p.userData.grow = opts.grow ?? 0;
      return p;
    }

    burst(x, y, z, count, opts = {}) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.3) * Math.PI;
        const speed = (opts.speed ?? 3) * (0.4 + Math.random() * 0.8);
        this.spawn(x, y, z, {
          ...opts,
          vx: Math.cos(angle) * Math.cos(elev) * speed,
          vy: Math.sin(elev) * speed + (opts.up ?? 1),
          vz: Math.sin(angle) * Math.cos(elev) * speed,
        });
      }
    }

    ring(x, y, z, count, opts = {}) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const speed = opts.speed ?? 4;
        this.spawn(x, y, z, {
          ...opts,
          vx: Math.cos(a) * speed,
          vy: opts.up ?? 0.5,
          vz: Math.sin(a) * speed,
          spread: 0.1,
        });
      }
    }

    update(dt) {
      for (const p of this.particles) {
        if (!p.userData.alive) continue;
        p.userData.life -= dt;
        if (p.userData.life <= 0) {
          p.userData.alive = false;
          p.visible = false;
          continue;
        }
        const u = p.userData;
        u.vel.y += u.gravity * dt;
        u.vel.multiplyScalar(u.drag);
        p.position.x += u.vel.x * dt;
        p.position.y += u.vel.y * dt;
        p.position.z += u.vel.z * dt;
        if (u.spin) p.rotation.y += u.spin * dt;
        if (u.grow) p.scale.multiplyScalar(1 + u.grow * dt);
        if (u.fade) p.material.opacity = (u.life / u.maxLife) * (p.material.opacity > 0 ? Math.min(1, p.material.opacity + 0.01) : 1) * (u.life / u.maxLife);
        // simpler fade
        const t = u.life / u.maxLife;
        if (u.fade) p.material.opacity = t;
      }
    }
  }

  class Shockwave {
    constructor(scene) {
      this.scene = scene;
      this.active = [];
      this.geo = new THREE.RingGeometry(0.3, 1, 48);
    }

    spawn(x, y, z, opts = {}) {
      const mat = new THREE.MeshBasicMaterial({
        color: opts.color ?? 0x7b2fff,
        transparent: true,
        opacity: opts.opacity ?? 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y + 0.05, z);
      mesh.scale.setScalar(opts.startScale ?? 0.5);
      this.scene.add(mesh);
      this.active.push({
        mesh,
        life: opts.life ?? 0.6,
        maxLife: opts.life ?? 0.6,
        speed: opts.speed ?? 12,
        maxScale: opts.maxScale ?? 8,
      });
    }

    update(dt) {
      for (let i = this.active.length - 1; i >= 0; i--) {
        const s = this.active[i];
        s.life -= dt;
        const t = 1 - s.life / s.maxLife;
        s.mesh.scale.setScalar(s.mesh.scale.x + s.speed * dt);
        s.mesh.material.opacity = (1 - t) * 0.85;
        if (s.life <= 0 || s.mesh.scale.x > s.maxScale) {
          this.scene.remove(s.mesh);
          s.mesh.geometry.dispose();
          s.mesh.material.dispose();
          this.active.splice(i, 1);
        }
      }
    }
  }

  class BeamEffect {
    constructor(scene) {
      this.scene = scene;
      this.active = [];
    }

    spawn(from, to, opts = {}) {
      const dir = new THREE.Vector3().subVectors(to, from);
      const len = dir.length();
      const geo = new THREE.CylinderGeometry(opts.radius ?? 0.08, opts.radius ?? 0.04, len, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: opts.color ?? 0xa855f7,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(from).add(to).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      this.scene.add(mesh);
      // Core
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry((opts.radius ?? 0.08) * 0.4, (opts.radius ?? 0.04) * 0.4, len, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false })
      );
      core.position.copy(mesh.position);
      core.quaternion.copy(mesh.quaternion);
      this.scene.add(core);
      this.active.push({ mesh, core, life: opts.life ?? 0.25, maxLife: opts.life ?? 0.25 });
    }

    update(dt) {
      for (let i = this.active.length - 1; i >= 0; i--) {
        const b = this.active[i];
        b.life -= dt;
        const t = b.life / b.maxLife;
        b.mesh.material.opacity = t * 0.9;
        b.core.material.opacity = t;
        if (b.life <= 0) {
          this.scene.remove(b.mesh, b.core);
          b.mesh.geometry.dispose(); b.mesh.material.dispose();
          b.core.geometry.dispose(); b.core.material.dispose();
          this.active.splice(i, 1);
        }
      }
    }
  }

  class TrailSystem {
    constructor(scene) {
      this.scene = scene;
      this.trails = [];
    }

    attach(object, opts = {}) {
      const trail = {
        object,
        points: [],
        maxPoints: opts.maxPoints ?? 12,
        color: opts.color ?? 0x7b2fff,
        width: opts.width ?? 0.15,
        life: opts.life ?? 0.3,
        meshes: [],
        active: true,
      };
      this.trails.push(trail);
      return trail;
    }

    update(dt) {
      for (const trail of this.trails) {
        if (!trail.active || !trail.object) continue;
        const pos = new THREE.Vector3();
        trail.object.getWorldPosition(pos);
        trail.points.unshift({ p: pos.clone(), life: trail.life });
        if (trail.points.length > trail.maxPoints) trail.points.pop();

        // fade points
        for (let i = trail.points.length - 1; i >= 0; i--) {
          trail.points[i].life -= dt;
          if (trail.points[i].life <= 0) trail.points.splice(i, 1);
        }

        // rebuild simple trail segments
        while (trail.meshes.length > trail.points.length - 1) {
          const m = trail.meshes.pop();
          if (m) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
        }
        for (let i = 0; i < trail.points.length - 1; i++) {
          let mesh = trail.meshes[i];
          const a = trail.points[i].p;
          const b = trail.points[i + 1].p;
          const mid = a.clone().add(b).multiplyScalar(0.5);
          const len = a.distanceTo(b);
          const opacity = (trail.points[i].life / trail.life) * (1 - i / trail.points.length) * 0.7;
          if (!mesh) {
            const geo = new THREE.CylinderGeometry(trail.width * (1 - i / trail.maxPoints), trail.width * 0.3, Math.max(len, 0.01), 4);
            const mat = new THREE.MeshBasicMaterial({ color: trail.color, transparent: true, opacity, depthWrite: false });
            mesh = new THREE.Mesh(geo, mat);
            this.scene.add(mesh);
            trail.meshes[i] = mesh;
          }
          mesh.position.copy(mid);
          mesh.material.opacity = opacity;
          const dir = b.clone().sub(a).normalize();
          if (dir.lengthSq() > 0.001) {
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          }
          mesh.scale.set(1, Math.max(len, 0.01) / (mesh.geometry.parameters?.height || 1), 1);
        }
      }
    }

    clear() {
      for (const trail of this.trails) {
        for (const m of trail.meshes) {
          this.scene.remove(m); m.geometry.dispose(); m.material.dispose();
        }
        trail.meshes = [];
        trail.points = [];
      }
    }
  }

  class VFX {
    constructor(scene) {
      this.scene = scene;
      this.particles = new ParticlePool(scene, 500);
      this.shockwaves = new Shockwave(scene);
      this.beams = new BeamEffect(scene);
      this.trails = new TrailSystem(scene);
      this.flashes = [];
      this.floatingTexts = []; // handled by DOM mostly
    }

    // ── Skill-specific VFX ──

    slash(pos, dir, color = 0xa855f7) {
      const d = dir.clone().normalize();
      for (let i = 0; i < 8; i++) {
        this.particles.spawn(pos.x, pos.y + 0.5, pos.z, {
          color, size: 0.06 + Math.random() * 0.08,
          vx: d.x * 4 + (Math.random() - 0.5) * 2,
          vy: 1 + Math.random() * 2,
          vz: d.z * 4 + (Math.random() - 0.5) * 2,
          life: 0.3 + Math.random() * 0.2, gravity: -4,
        });
      }
      // Arc slash mesh
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(1.2, 0.06, 6, 16, Math.PI * 0.7),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
      );
      arc.position.copy(pos); arc.position.y += 1.0;
      arc.lookAt(pos.clone().add(d));
      arc.rotateX(Math.PI / 2);
      this.scene.add(arc);
      this.flashes.push({ mesh: arc, life: 0.2, maxLife: 0.2, scaleSpeed: 3 });
    }

    mutilation(pos) {
      // Flurry of slashes — Jinwoo's signature
      for (let i = 0; i < 12; i++) {
        setTimeout(() => {
          const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            0.5 + Math.random() * 1.5,
            (Math.random() - 0.5) * 2
          );
          const p = pos.clone().add(offset);
          this.particles.burst(p.x, p.y, p.z, 6, {
            color: 0xa855f7, speed: 5, size: 0.07, life: 0.35, up: 0.5,
          });
          // Slash line
          const line = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.05, 2.5),
            new THREE.MeshBasicMaterial({ color: 0xe0c0ff, transparent: true, opacity: 0.95, depthWrite: false })
          );
          line.position.copy(p);
          line.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          this.scene.add(line);
          this.flashes.push({ mesh: line, life: 0.15, maxLife: 0.15, scaleSpeed: 0 });
        }, i * 40);
      }
      this.shockwaves.spawn(pos.x, pos.y, pos.z, { color: 0x7b2fff, speed: 15, maxScale: 6, life: 0.5 });
    }

    bloodlust(pos) {
      this.particles.ring(pos.x, pos.y + 0.5, pos.z, 24, {
        color: 0xff2d55, speed: 6, size: 0.1, life: 0.8, up: 0.2,
      });
      this.shockwaves.spawn(pos.x, pos.y, pos.z, { color: 0xff2d55, speed: 10, maxScale: 10, life: 0.7 });
      // Dark aura pillar
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 2.5, 4, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x4a0020, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
      );
      pillar.position.set(pos.x, pos.y + 2, pos.z);
      this.scene.add(pillar);
      this.flashes.push({ mesh: pillar, life: 0.8, maxLife: 0.8, scaleSpeed: 1.5 });
    }

    monarchDomain(pos) {
      this.shockwaves.spawn(pos.x, pos.y, pos.z, { color: 0x7b2fff, speed: 20, maxScale: 20, life: 1.0 });
      this.particles.ring(pos.x, pos.y + 0.2, pos.z, 40, {
        color: 0xa855f7, speed: 10, size: 0.12, life: 1.0, up: 1,
      });
      // Domain circle
      const domain = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 12, 64),
        new THREE.MeshBasicMaterial({ color: 0x7b2fff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
      );
      domain.rotation.x = -Math.PI / 2;
      domain.position.set(pos.x, pos.y + 0.08, pos.z);
      this.scene.add(domain);
      this.flashes.push({ mesh: domain, life: 4.0, maxLife: 4.0, scaleSpeed: 0 });
      // Rising shadow pillars
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const px = pos.x + Math.cos(a) * 6;
        const pz = pos.z + Math.sin(a) * 6;
        const p = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.3, 3, 6),
          new THREE.MeshBasicMaterial({ color: 0x4a2080, transparent: true, opacity: 0.5, depthWrite: false })
        );
        p.position.set(px, pos.y + 1.5, pz);
        this.scene.add(p);
        this.flashes.push({ mesh: p, life: 3.5, maxLife: 3.5, scaleSpeed: 0 });
      }
    }

    shadowExchange(pos) {
      this.particles.burst(pos.x, pos.y + 1, pos.z, 30, {
        color: 0x7b2fff, speed: 8, size: 0.1, life: 0.6, up: 2,
      });
      this.shockwaves.spawn(pos.x, pos.y, pos.z, { color: 0xa855f7, speed: 12, maxScale: 5 });
      // Portal disc
      const portal = new THREE.Mesh(
        new THREE.CircleGeometry(1.5, 32),
        new THREE.MeshBasicMaterial({ color: 0x2a0a50, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
      );
      portal.rotation.x = -Math.PI / 2;
      portal.position.set(pos.x, pos.y + 0.1, pos.z);
      this.scene.add(portal);
      this.flashes.push({ mesh: portal, life: 0.5, maxLife: 0.5, scaleSpeed: -2 });
    }

    arise(pos) {
      this.particles.burst(pos.x, pos.y + 0.5, pos.z, 50, {
        color: 0xa855f7, speed: 6, size: 0.12, life: 1.5, up: 4, gravity: -2,
      });
      this.shockwaves.spawn(pos.x, pos.y, pos.z, { color: 0x7b2fff, speed: 8, maxScale: 15, life: 1.2 });
      // Rising darkness
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          this.particles.ring(pos.x, pos.y + i * 0.3, pos.z, 16, {
            color: 0x7b2fff, speed: 3 + i, size: 0.08, life: 0.8, up: 2,
          });
        }, i * 100);
      }
    }

    daggerRush(from, targets) {
      for (const t of targets) {
        this.beams.spawn(from, t, { color: 0xa855f7, radius: 0.06, life: 0.2 });
        this.particles.burst(t.x, t.y, t.z, 8, { color: 0xc080ff, speed: 4, size: 0.06, life: 0.3 });
      }
    }

    rulersAuthority(pos, target) {
      this.beams.spawn(pos, target, { color: 0x5ee7ff, radius: 0.12, life: 0.4 });
      this.particles.burst(target.x, target.y, target.z, 20, {
        color: 0x5ee7ff, speed: 5, size: 0.1, life: 0.5, up: 1,
      });
      this.shockwaves.spawn(target.x, target.y, target.z, { color: 0x5ee7ff, speed: 10, maxScale: 4 });
    }

    fireMagic(pos, target) {
      this.beams.spawn(pos, target, { color: 0xff6b2d, radius: 0.15, life: 0.35 });
      this.particles.burst(target.x, target.y + 0.5, target.z, 25, {
        color: 0xff6b2d, speed: 5, size: 0.12, life: 0.7, up: 3, gravity: -6,
      });
      // Flame pillar
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 3, 8),
        new THREE.MeshBasicMaterial({ color: 0xff6b2d, transparent: true, opacity: 0.7, depthWrite: false })
      );
      flame.position.set(target.x, target.y + 1.5, target.z);
      this.scene.add(flame);
      this.flashes.push({ mesh: flame, life: 0.5, maxLife: 0.5, scaleSpeed: 2 });
    }

    swordLight(pos, dir) {
      this.slash(pos, dir, 0xd0e8ff);
      this.particles.burst(pos.x + dir.x, pos.y + 1, pos.z + dir.z, 12, {
        color: 0xa0d0ff, speed: 4, size: 0.08, life: 0.4,
      });
    }

    healPulse(pos) {
      this.particles.ring(pos.x, pos.y + 0.5, pos.z, 16, {
        color: 0x3dff9a, speed: 3, size: 0.1, life: 0.8, up: 2,
      });
      this.shockwaves.spawn(pos.x, pos.y, pos.z, { color: 0x3dff9a, speed: 6, maxScale: 5, life: 0.6 });
    }

    poisonSpit(from, to) {
      this.beams.spawn(from, to, { color: 0x88ff22, radius: 0.1, life: 0.3 });
      this.particles.burst(to.x, to.y, to.z, 15, {
        color: 0x88ff22, speed: 3, size: 0.1, life: 0.8, gravity: -3,
      });
    }

    iceBlast(pos) {
      this.particles.burst(pos.x, pos.y + 1, pos.z, 30, {
        color: 0x5ee7ff, speed: 6, size: 0.1, life: 0.7, up: 1, gravity: -2,
      });
      this.shockwaves.spawn(pos.x, pos.y, pos.z, { color: 0x5ee7ff, speed: 10, maxScale: 7 });
    }

    hit(pos, heavy = false) {
      this.particles.burst(pos.x, pos.y + 1, pos.z, heavy ? 16 : 6, {
        color: heavy ? 0xff2d55 : 0xffffff,
        speed: heavy ? 5 : 3,
        size: heavy ? 0.1 : 0.05,
        life: 0.3,
        up: 1,
      });
    }

    death(pos, isShadow = false) {
      const color = isShadow ? 0x7b2fff : 0xff4422;
      this.particles.burst(pos.x, pos.y + 0.5, pos.z, 20, {
        color, speed: 4, size: 0.1, life: 0.8, up: 2, gravity: -3,
      });
      this.shockwaves.spawn(pos.x, pos.y, pos.z, { color, speed: 8, maxScale: 3, life: 0.4 });
    }

    shadowAura(pos, dt) {
      if (Math.random() > 0.7) {
        this.particles.spawn(
          pos.x + (Math.random() - 0.5) * 0.8,
          pos.y + Math.random() * 1.5,
          pos.z + (Math.random() - 0.5) * 0.8,
          { color: 0x7b2fff, size: 0.05, vy: 1 + Math.random(), life: 0.5, spread: 0.2, gravity: 0 }
        );
      }
    }

    bossAura(pos) {
      if (Math.random() > 0.6) {
        this.particles.spawn(
          pos.x + (Math.random() - 0.5) * 2,
          pos.y + Math.random() * 2,
          pos.z + (Math.random() - 0.5) * 2,
          { color: 0xff1a2e, size: 0.08, vy: 0.5, life: 0.6, spread: 0.3 }
        );
      }
    }

    update(dt) {
      this.particles.update(dt);
      this.shockwaves.update(dt);
      this.beams.update(dt);
      this.trails.update(dt);

      for (let i = this.flashes.length - 1; i >= 0; i--) {
        const f = this.flashes[i];
        f.life -= dt;
        const t = f.life / f.maxLife;
        f.mesh.material.opacity = t * (f.mesh.material.opacity > 0.01 ? 1 : 1) * Math.min(1, t + 0.2);
        if (f.scaleSpeed) f.mesh.scale.multiplyScalar(1 + f.scaleSpeed * dt * 0.3);
        f.mesh.material.opacity = Math.max(0, t * 0.85);
        if (f.life <= 0) {
          this.scene.remove(f.mesh);
          f.mesh.geometry.dispose();
          f.mesh.material.dispose();
          this.flashes.splice(i, 1);
        }
      }
    }
  }

  global.JejuVFX = VFX;
})(typeof window !== 'undefined' ? window : globalThis);
