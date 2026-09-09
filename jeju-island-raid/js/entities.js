/**
 * JEJU ISLAND RAID — Entity & Combat Systems
 * Player, enemies, allies, shadows, AI
 */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const Models = global.JejuModels;

  // ── Skills database (Jinwoo at Jeju Island power level ~Lv 100) ──
  const SKILLS = {
    basic: { name: 'Dagger Strike', mp: 0, cd: 0.28, dmg: [80, 120], range: 3.2, type: 'melee' },
    mutilation: {
      name: 'Mutilation', key: '1', mp: 80, cd: 5.5,
      dmg: [180, 280], hits: 8, range: 5, type: 'aoe',
      desc: 'Rapid vital-point slashes — evolved Critical Attack',
    },
    daggerRush: {
      name: 'Dagger Rush', key: '2', mp: 60, cd: 4.0,
      dmg: [100, 150], hits: 5, range: 12, type: 'ranged',
      desc: 'Barrage of daggers from all directions',
    },
    bloodlust: {
      name: 'Bloodlust', key: '3', mp: 100, cd: 12,
      dmg: [0, 0], range: 14, type: 'debuff', duration: 5,
      desc: 'Induce fear — enemy stats -50% for 5s',
    },
    rulersAuthority: {
      name: "Ruler's Authority", key: '4', mp: 70, cd: 6,
      dmg: [200, 320], range: 15, type: 'ranged',
      desc: 'Telekinetic crush — slam foes into the earth',
    },
    monarchDomain: {
      name: "Monarch's Domain", key: '5', mp: 150, cd: 20,
      dmg: [0, 0], range: 18, type: 'buff', duration: 8,
      desc: 'Shadow soldiers +50% power. Domain of the Shadow Monarch.',
    },
    quicksilver: {
      name: 'Quicksilver', key: 'Q', mp: 30, cd: 3.5,
      dmg: [0, 0], type: 'buff', duration: 3,
      desc: 'Movement speed +30%',
    },
    stealth: {
      name: 'Stealth', key: 'E', mp: 40, cd: 8,
      dmg: [0, 0], type: 'buff', duration: 4,
      desc: 'Vanish from sight. Next attack crits.',
    },
    shadowExchange: {
      name: 'Shadow Exchange', key: 'R', mp: 50, cd: 7,
      dmg: [50, 80], range: 20, type: 'mobility',
      desc: 'Teleport via shadow. Damages on arrival.',
    },
    arise: {
      name: 'ARISE', key: 'F', mp: 0, cd: 2,
      dmg: [0, 0], type: 'special',
      desc: 'Extract shadow from fallen foes',
    },
  };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  class Entity {
    constructor(mesh, opts = {}) {
      this.mesh = mesh;
      this.hp = opts.hp ?? 100;
      this.maxHp = opts.maxHp ?? this.hp;
      this.mp = opts.mp ?? 0;
      this.maxMp = opts.maxMp ?? 0;
      this.speed = opts.speed ?? 6;
      this.radius = opts.radius ?? mesh.userData.radius ?? 0.4;
      this.height = opts.height ?? mesh.userData.height ?? 1.8;
      this.alive = true;
      this.team = opts.team ?? 'neutral'; // player | ally | shadow | enemy | boss
      this.name = opts.name ?? 'Entity';
      this.damage = opts.damage ?? 20;
      this.defense = opts.defense ?? 0;
      this.velocity = new THREE.Vector3();
      this.knockback = new THREE.Vector3();
      this.hitFlash = 0;
      this.animTime = Math.random() * 10;
      this.state = 'idle';
      this.target = null;
      this.atkCd = 0;
      this.buffs = {};
      this.debuffs = {};
      this.id = Entity._id++;
      this.xpValue = opts.xpValue ?? 10;
      this.extractable = opts.extractable ?? false;
      this.extracted = false;
      this.invuln = 0;
      this.facing = new THREE.Vector3(0, 0, 1);
    }

    get position() { return this.mesh.position; }

    takeDamage(amount, source = null) {
      if (!this.alive || this.invuln > 0) return 0;
      let dmg = amount;
      // Bloodlust debuff
      if (this.debuffs.bloodlust) dmg *= 1.5;
      dmg = Math.max(1, dmg - this.defense * 0.1);
      // Domain buff on attacker handled externally
      this.hp -= dmg;
      this.hitFlash = 0.15;
      if (this.hp <= 0) {
        this.hp = 0;
        this.die(source);
      }
      return dmg;
    }

    heal(amount) {
      if (!this.alive) return 0;
      const before = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + amount);
      return this.hp - before;
    }

    die(source) {
      this.alive = false;
      this.state = 'dead';
      this.onDeath && this.onDeath(source);
    }

    applyBuff(name, duration, data = {}) {
      this.buffs[name] = { t: duration, ...data };
    }

    applyDebuff(name, duration, data = {}) {
      this.debuffs[name] = { t: duration, ...data };
    }

    hasBuff(name) { return !!this.buffs[name]; }
    hasDebuff(name) { return !!this.debuffs[name]; }

    updateBuffs(dt) {
      for (const k of Object.keys(this.buffs)) {
        this.buffs[k].t -= dt;
        if (this.buffs[k].t <= 0) delete this.buffs[k];
      }
      for (const k of Object.keys(this.debuffs)) {
        this.debuffs[k].t -= dt;
        if (this.debuffs[k].t <= 0) delete this.debuffs[k];
      }
      if (this.invuln > 0) this.invuln -= dt;
      if (this.atkCd > 0) this.atkCd -= dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
    }

    faceToward(pos) {
      const dx = pos.x - this.position.x;
      const dz = pos.z - this.position.z;
      if (Math.abs(dx) + Math.abs(dz) < 0.01) return;
      this.facing.set(dx, 0, dz).normalize();
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }

    distanceTo(other) {
      return this.position.distanceTo(other.position);
    }

    // Idle/walk bob animation
    animate(dt) {
      this.animTime += dt;
      if (!this.alive) {
        this.mesh.scale.y = Math.max(0.05, this.mesh.scale.y - dt * 2);
        this.mesh.position.y -= dt * 0.5;
        return;
      }
      const bob = Math.sin(this.animTime * (this.state === 'move' ? 10 : 2)) * (this.state === 'move' ? 0.04 : 0.015);
      // subtle arm swing via child names
      const armL = this.mesh.getObjectByName('armL');
      const armR = this.mesh.getObjectByName('armR');
      if (armL && armR && this.state === 'move') {
        armL.rotation.x = Math.sin(this.animTime * 10) * 0.4;
        armR.rotation.x = Math.sin(this.animTime * 10 + Math.PI) * 0.4;
      }
      // Wing flutter
      for (let i = 0; i < 4; i++) {
        const w = this.mesh.getObjectByName('wing' + i);
        if (w) w.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.3 + Math.sin(this.animTime * 20) * 0.25);
      }
      // Aura spin
      const aura = this.mesh.getObjectByName('aura') || this.mesh.getObjectByName('menace');
      if (aura) aura.rotation.z += dt * 2;

      // Hit flash — emissive pulse via traverse
      if (this.hitFlash > 0) {
        this.mesh.traverse(c => {
          if (c.isMesh && c.material && c.material.emissive) {
            c.material.emissiveIntensity = (c.userData._baseEmissive ?? c.material.emissiveIntensity) + this.hitFlash * 3;
          }
        });
      }
    }
  }
  Entity._id = 1;

  // ═══════════════════════════════════════
  // PLAYER — Sung Jinwoo
  // ═══════════════════════════════════════
  class Player extends Entity {
    constructor(mesh) {
      super(mesh, {
        hp: 4500, maxHp: 4500,
        mp: 2800, maxMp: 2800,
        speed: 11, team: 'player',
        name: 'Sung Jin-Woo', damage: 150, defense: 80,
        radius: 0.45, height: 2.0,
      });
      this.level = 100;
      this.xp = 0;
      this.xpToLevel = 5000;
      this.kills = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.skillCd = {};
      this.shadowArmy = [];
      this.maxShadows = 50;
      this.domainActive = false;
      this.stealthNextCrit = false;
      this.stats = { str: 250, agi: 240, vit: 220, int: 200, sense: 210 };
      Object.keys(SKILLS).forEach(k => { this.skillCd[k] = 0; });
    }

    canUse(skillKey) {
      const s = SKILLS[skillKey];
      if (!s) return false;
      if (this.skillCd[skillKey] > 0) return false;
      if (this.mp < s.mp) return false;
      return this.alive;
    }

    useMp(amount) {
      this.mp = Math.max(0, this.mp - amount);
    }

    regen(dt) {
      if (!this.alive) return;
      this.mp = Math.min(this.maxMp, this.mp + 40 * dt);
      // Will to Recover passive
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 15 * dt);
    }

    addCombo() {
      this.combo++;
      this.comboTimer = 2.5;
    }

    update(dt) {
      this.updateBuffs(dt);
      this.regen(dt);
      this.animate(dt);
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
      }
      for (const k of Object.keys(this.skillCd)) {
        if (this.skillCd[k] > 0) this.skillCd[k] -= dt;
      }
      // Quicksilver
      this._speedMul = this.hasBuff('quicksilver') ? 1.3 : 1.0;
      // Stealth visual
      if (this.hasBuff('stealth')) {
        this.mesh.traverse(c => {
          if (c.isMesh && c.material) {
            c.material.transparent = true;
            c.material.opacity = 0.35;
          }
        });
      } else {
        this.mesh.traverse(c => {
          if (c.isMesh && c.material && c.material.opacity < 1 && !c.material.userData?.keepTransparent) {
            c.material.opacity = c.material.userData?.baseOpacity ?? 1;
          }
        });
      }
      // Knockback decay
      this.knockback.multiplyScalar(0.85);
      this.position.add(this.knockback.clone().multiplyScalar(dt));
    }

    get moveSpeed() { return this.speed * (this._speedMul || 1); }
  }

  // ═══════════════════════════════════════
  // ENEMY — Mutant Ant
  // ═══════════════════════════════════════
  class AntEnemy extends Entity {
    constructor(mesh, opts = {}) {
      super(mesh, {
        hp: opts.hp ?? 280,
        maxHp: opts.hp ?? 280,
        speed: opts.speed ?? 5.5,
        team: 'enemy',
        name: opts.name ?? 'Mutant Ant',
        damage: opts.damage ?? 35,
        defense: opts.defense ?? 5,
        xpValue: opts.xpValue ?? 40,
        extractable: true,
        radius: 0.4, height: 0.9,
      });
      this.aggroRange = opts.aggroRange ?? 22;
      this.attackRange = 1.8;
      this.attackCdMax = 1.4;
      this.flying = opts.flying ?? false;
      this.wanderTarget = null;
      this.wanderTimer = 0;
    }

    updateAI(dt, player, allies) {
      if (!this.alive) { this.animate(dt); return; }
      this.updateBuffs(dt);
      this.animate(dt);

      // Bloodlust slows and weakens
      const speedMul = this.hasDebuff('bloodlust') ? 0.5 : 1;

      // Find nearest threat
      let target = player;
      let bestDist = this.distanceTo(player);
      for (const a of allies) {
        if (!a.alive) continue;
        const d = this.distanceTo(a);
        if (d < bestDist) { bestDist = d; target = a; }
      }

      if (bestDist < this.aggroRange && target.alive) {
        this.target = target;
        this.state = 'chase';
        this.faceToward(target.position);
        if (bestDist > this.attackRange) {
          const dir = new THREE.Vector3()
            .subVectors(target.position, this.position)
            .setY(0).normalize();
          this.position.x += dir.x * this.speed * speedMul * dt;
          this.position.z += dir.z * this.speed * speedMul * dt;
          if (this.flying) this.position.y = 1.2 + Math.sin(this.animTime * 3) * 0.3;
        } else if (this.atkCd <= 0) {
          this.state = 'attack';
          this.atkCd = this.attackCdMax;
          return { type: 'attack', target, damage: this.damage * (this.hasDebuff('bloodlust') ? 0.5 : 1) };
        }
      } else {
        this.state = 'wander';
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0 || !this.wanderTarget) {
          this.wanderTarget = new THREE.Vector3(
            this.position.x + (Math.random() - 0.5) * 16,
            0,
            this.position.z + (Math.random() - 0.5) * 16
          );
          this.wanderTimer = 2 + Math.random() * 3;
        }
        const dir = new THREE.Vector3().subVectors(this.wanderTarget, this.position).setY(0);
        if (dir.length() > 0.5) {
          dir.normalize();
          this.position.x += dir.x * this.speed * 0.4 * dt;
          this.position.z += dir.z * this.speed * 0.4 * dt;
          this.faceToward(this.wanderTarget);
        }
      }

      // Keep on ground
      if (!this.flying) this.position.y = 0;
      this.knockback.multiplyScalar(0.85);
      this.position.addScaledVector(this.knockback, dt);
      return null;
    }
  }

  // ═══════════════════════════════════════
  // BOSS — Ant King
  // ═══════════════════════════════════════
  class AntKing extends Entity {
    constructor(mesh) {
      super(mesh, {
        hp: 45000, maxHp: 45000,
        speed: 9, team: 'boss',
        name: 'Ant King', damage: 280, defense: 60,
        xpValue: 10000, extractable: true,
        radius: 1.2, height: 2.8,
      });
      this.phase = 1;
      this.attackCdMax = 1.6;
      this.specialCd = 0;
      this.enraged = false;
      this.dialogueIdx = 0;
      this.dialogues = [
        'Are there others? Others you call king?',
        'You... are strong.',
        'I will devour your power!',
        'This cannot be...!',
      ];
      this.movePattern = 0;
      this.patternTimer = 0;
      this.canFlee = true;
      this.healed = false;
    }

    get phaseThresholds() {
      return [0.66, 0.33, 0]; // HP ratios for phase 2, 3
    }

    updateAI(dt, player, world) {
      if (!this.alive) { this.animate(dt); return null; }
      this.updateBuffs(dt);
      this.animate(dt);
      this.specialCd -= dt;
      this.patternTimer -= dt;

      // Phase transitions
      const ratio = this.hp / this.maxHp;
      if (ratio < 0.66 && this.phase === 1) { this.phase = 2; this.enraged = true; this.speed = 11; this.damage = 340; return { type: 'phase', phase: 2 }; }
      if (ratio < 0.33 && this.phase === 2) { this.phase = 3; this.speed = 13; this.damage = 400; return { type: 'phase', phase: 3 }; }

      if (!player.alive) return null;

      const dist = this.distanceTo(player);
      this.faceToward(player.position);
      this.target = player;

      const speedMul = this.hasDebuff('bloodlust') ? 0.5 : 1;
      const dmgMul = this.hasDebuff('bloodlust') ? 0.5 : 1;

      // Special abilities by phase
      if (this.specialCd <= 0) {
        this.specialCd = this.phase === 1 ? 5 : this.phase === 2 ? 3.5 : 2.5;
        const roll = Math.random();

        if (this.phase >= 2 && roll < 0.3) {
          // Poison spit
          return { type: 'poison', target: player, damage: 180 * dmgMul };
        }
        if (this.phase >= 2 && roll < 0.5) {
          // Size manipulation — grow and smash
          return { type: 'smash', damage: 350 * dmgMul, range: 5 };
        }
        if (this.phase >= 3 && roll < 0.7) {
          // Ice blast (anime ability)
          return { type: 'ice', damage: 250 * dmgMul, range: 8 };
        }
        if (this.phase >= 3 && ratio < 0.2 && this.canFlee && !this.healed) {
          // Heal self (gluttony - absorbed healer)
          this.healed = true;
          return { type: 'heal_self', amount: 5000 };
        }
        // Wing dive
        return { type: 'dive', target: player, damage: 300 * dmgMul };
      }

      // Basic combat movement
      if (dist > 3.5) {
        this.state = 'chase';
        const dir = new THREE.Vector3().subVectors(player.position, this.position).setY(0).normalize();
        // Strafe occasionally
        if (this.patternTimer <= 0) {
          this.movePattern = (this.movePattern + 1) % 3;
          this.patternTimer = 1.5;
        }
        if (this.movePattern === 1) {
          // circle
          const perp = new THREE.Vector3(-dir.z, 0, dir.x);
          this.position.addScaledVector(perp, this.speed * speedMul * 0.7 * dt);
          this.position.addScaledVector(dir, this.speed * speedMul * 0.4 * dt);
        } else {
          this.position.addScaledVector(dir, this.speed * speedMul * dt);
        }
        // Hover
        this.position.y = 0.15 + Math.sin(this.animTime * 2) * 0.1;
      } else if (this.atkCd <= 0) {
        this.state = 'attack';
        this.atkCd = this.attackCdMax * (this.enraged ? 0.7 : 1);
        return { type: 'slash', target: player, damage: this.damage * dmgMul };
      }

      this.knockback.multiplyScalar(0.8);
      this.position.addScaledVector(this.knockback, dt);
      // Soft ground clamp
      if (this.position.y < 0) this.position.y = 0;
      return null;
    }
  }

  // ═══════════════════════════════════════
  // SHADOW SOLDIER
  // ═══════════════════════════════════════
  class ShadowSoldier extends Entity {
    constructor(mesh, opts = {}) {
      super(mesh, {
        hp: opts.hp ?? 800,
        maxHp: opts.hp ?? 800,
        speed: opts.speed ?? 7,
        team: 'shadow',
        name: opts.name ?? 'Shadow',
        damage: opts.damage ?? 60,
        defense: opts.defense ?? 20,
        radius: mesh.userData.radius ?? 0.4,
        height: mesh.userData.height ?? 1.8,
      });
      this.grade = opts.grade ?? 'Normal'; // Normal | Elite | Knight | Elite Knight | General | Marshal
      this.role = opts.role ?? 'melee'; // melee | tank | mage | ranged
      this.followDist = opts.followDist ?? 4;
      this.attackRange = opts.attackRange ?? 2.5;
      this.attackCdMax = opts.attackCdMax ?? 1.2;
      this.specialCd = 0;
      this.owner = null;
      this.immortal = true; // shadows reform
      this.reformTimer = 0;
    }

    updateAI(dt, player, enemies, domainBuff) {
      if (!this.alive) {
        this.reformTimer -= dt;
        if (this.reformTimer <= 0 && this.immortal) {
          this.alive = true;
          this.hp = this.maxHp * 0.5;
          this.mesh.visible = true;
          this.mesh.scale.setScalar(1);
          this.position.copy(player.position);
          this.position.x += (Math.random() - 0.5) * 4;
          this.position.z += (Math.random() - 0.5) * 4;
        }
        this.animate(dt);
        return null;
      }

      this.updateBuffs(dt);
      this.animate(dt);
      this.specialCd -= dt;

      const dmgMul = domainBuff ? 1.5 : 1;
      const speedMul = domainBuff ? 1.2 : 1;

      // Find nearest enemy
      let nearest = null;
      let nearestDist = Infinity;
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = this.distanceTo(e);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }

      if (nearest && nearestDist < 25) {
        this.target = nearest;
        this.faceToward(nearest.position);
        if (nearestDist > this.attackRange) {
          this.state = 'chase';
          const dir = new THREE.Vector3().subVectors(nearest.position, this.position).setY(0).normalize();
          this.position.addScaledVector(dir, this.speed * speedMul * dt);
        } else if (this.atkCd <= 0) {
          this.state = 'attack';
          this.atkCd = this.attackCdMax;
          let dmg = this.damage * dmgMul;
          if (this.role === 'mage') {
            return { type: 'magic', target: nearest, damage: dmg * 1.4 };
          }
          return { type: 'attack', target: nearest, damage: dmg };
        }
      } else {
        // Follow player
        this.state = 'follow';
        const dist = this.distanceTo(player);
        if (dist > this.followDist) {
          const dir = new THREE.Vector3().subVectors(player.position, this.position).setY(0).normalize();
          this.position.addScaledVector(dir, this.speed * 0.9 * speedMul * dt);
          this.faceToward(player.position);
        }
      }

      this.position.y = 0;
      return null;
    }

    die() {
      this.alive = false;
      this.state = 'dead';
      this.mesh.visible = false;
      this.reformTimer = 4.0; // reform after 4s
    }
  }

  // ═══════════════════════════════════════
  // ALLIED HUNTER
  // ═══════════════════════════════════════
  class AllyHunter extends Entity {
    constructor(mesh, opts = {}) {
      super(mesh, {
        hp: opts.hp ?? 2000,
        maxHp: opts.hp ?? 2000,
        speed: opts.speed ?? 7,
        team: 'ally',
        name: opts.name ?? 'Hunter',
        damage: opts.damage ?? 80,
        defense: opts.defense ?? 30,
        radius: 0.4, height: 1.8,
      });
      this.role = opts.role ?? 'fighter'; // fighter | mage | tank | archer | healer
      this.attackRange = opts.attackRange ?? 2.5;
      this.attackCdMax = opts.attackCdMax ?? 1.3;
      this.specialCd = 0;
      this.skillName = opts.skillName ?? 'Attack';
      this.downed = false;
    }

    updateAI(dt, player, enemies) {
      if (!this.alive) { this.animate(dt); return null; }
      this.updateBuffs(dt);
      this.animate(dt);
      this.specialCd -= dt;

      // Healer prioritizes healing
      if (this.role === 'healer') {
        const needHeal = [player, ...arguments[2] ? [] : []];
        // heal lowest ally — handled in main with full ally list
      }

      let nearest = null;
      let nearestDist = Infinity;
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = this.distanceTo(e);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }

      // Stay near player loosely
      const pDist = this.distanceTo(player);

      if (this.role === 'healer') {
        // Stay back, heal
        if (pDist > 8) {
          const dir = new THREE.Vector3().subVectors(player.position, this.position).setY(0).normalize();
          this.position.addScaledVector(dir, this.speed * 0.7 * dt);
        }
        if (this.specialCd <= 0 && player.hp < player.maxHp * 0.7) {
          this.specialCd = 4;
          return { type: 'heal', target: player, amount: 400 };
        }
        if (nearest && nearestDist < this.attackRange && this.atkCd <= 0) {
          this.atkCd = this.attackCdMax;
          return { type: 'attack', target: nearest, damage: this.damage * 0.5 };
        }
        this.position.y = 0;
        return null;
      }

      if (nearest && nearestDist < 20) {
        this.faceToward(nearest.position);
        const range = this.role === 'mage' || this.role === 'archer' ? 12 : this.attackRange;
        if (nearestDist > range) {
          const dir = new THREE.Vector3().subVectors(nearest.position, this.position).setY(0).normalize();
          this.position.addScaledVector(dir, this.speed * dt);
          this.state = 'chase';
        } else if (this.atkCd <= 0) {
          this.atkCd = this.attackCdMax;
          this.state = 'attack';
          if (this.role === 'mage') {
            this.specialCd = 2;
            return { type: 'fire', target: nearest, damage: this.damage * 1.5 };
          }
          if (this.role === 'archer') {
            return { type: 'arrow', target: nearest, damage: this.damage * 1.2 };
          }
          if (this.role === 'fighter' && this.specialCd <= 0) {
            this.specialCd = 5;
            return { type: 'swordlight', target: nearest, damage: this.damage * 1.8 };
          }
          return { type: 'attack', target: nearest, damage: this.damage };
        }
      } else if (pDist > 10) {
        const dir = new THREE.Vector3().subVectors(player.position, this.position).setY(0).normalize();
        this.position.addScaledVector(dir, this.speed * 0.6 * dt);
        this.faceToward(player.position);
      }

      this.position.y = 0;
      this.knockback.multiplyScalar(0.85);
      this.position.addScaledVector(this.knockback, dt);
      return null;
    }
  }

  // ═══════════════════════════════════════
  // FACTORY
  // ═══════════════════════════════════════
  const Entities = {
    SKILLS,

    createPlayer() {
      const mesh = Models.createJinwoo();
      return new Player(mesh);
    },

    createAnt(variant = 0, elite = false) {
      const mesh = Models.createAnt(variant);
      return new AntEnemy(mesh, {
        hp: elite ? 700 : 280,
        damage: elite ? 70 : 35,
        speed: elite ? 6.5 : 5.5,
        flying: variant % 2 === 0,
        name: elite ? 'Elite Soldier Ant' : (variant % 2 === 0 ? 'Flying Ant' : 'Mutant Ant'),
        xpValue: elite ? 100 : 40,
      });
    },

    createAntKing() {
      const mesh = Models.createAntKing(1.4);
      return new AntKing(mesh);
    },

    createShadow(type, owner) {
      let mesh, opts;
      switch (type) {
        case 'igris':
          mesh = Models.createIgris();
          opts = { name: 'Igris', grade: 'Marshal', role: 'melee', hp: 5000, damage: 220, speed: 9, attackRange: 3, attackCdMax: 1.0 };
          break;
        case 'iron':
          mesh = Models.createIron();
          opts = { name: 'Iron', grade: 'Elite Knight', role: 'tank', hp: 6000, damage: 120, speed: 5.5, attackRange: 2.5, defense: 80 };
          break;
        case 'tank':
          mesh = Models.createTank();
          opts = { name: 'Tank', grade: 'Knight', role: 'tank', hp: 4500, damage: 140, speed: 6, attackRange: 2.8 };
          break;
        case 'tusk':
          mesh = Models.createTusk();
          opts = { name: 'Tusk', grade: 'General', role: 'mage', hp: 3000, damage: 200, speed: 5, attackRange: 14, attackCdMax: 2.0 };
          break;
        case 'beru':
          mesh = Models.createAntKing(0.9);
          // Recolor as shadow
          mesh.traverse(c => {
            if (c.isMesh && c.material) {
              if (c.material.color) c.material.color.offsetHSL(0.7, 0.2, -0.1);
              if (c.material.emissive) c.material.emissive.set(0x4a2080);
            }
          });
          opts = { name: 'Beru', grade: 'Marshal', role: 'melee', hp: 8000, damage: 350, speed: 12, attackRange: 3.5, attackCdMax: 0.8 };
          break;
        default:
          mesh = Models.createShadowSoldier(Math.floor(Math.random() * 10));
          opts = { name: 'Shadow Soldier', grade: 'Normal', role: 'melee', hp: 600, damage: 55, speed: 7 };
      }
      const s = new ShadowSoldier(mesh, opts);
      s.owner = owner;
      return s;
    },

    createAlly(type) {
      switch (type) {
        case 'cha':
          return new AllyHunter(Models.createChaHaeIn(), {
            name: 'Cha Hae-In', role: 'fighter', hp: 3200, damage: 160, speed: 9,
            attackRange: 3, skillName: 'Sword of Light',
          });
        case 'baek':
          return new AllyHunter(Models.createBaekYoonho(), {
            name: 'Baek Yoonho', role: 'fighter', hp: 3800, damage: 140, speed: 8,
            attackRange: 2.8, skillName: 'White Tiger',
          });
        case 'choi':
          return new AllyHunter(Models.createChoiJongIn(), {
            name: 'Choi Jong-In', role: 'mage', hp: 2200, damage: 180, speed: 6,
            attackRange: 14, attackCdMax: 1.8, skillName: 'Flame Dragon',
          });
        case 'ma':
          return new AllyHunter(Models.createMaDongwook(), {
            name: 'Ma Dongwook', role: 'tank', hp: 4500, damage: 100, speed: 5.5,
            attackRange: 2.5, defense: 70, skillName: 'Crushing Blow',
          });
        case 'lim':
          return new AllyHunter(Models.createLimTaeGyu(), {
            name: 'Lim Tae-Gyu', role: 'archer', hp: 2000, damage: 130, speed: 7,
            attackRange: 16, attackCdMax: 1.1, skillName: 'Mana Arrow',
          });
        case 'min':
          return new AllyHunter(Models.createMinByungGyu(), {
            name: 'Min Byung-Gyu', role: 'healer', hp: 1800, damage: 40, speed: 6,
            attackRange: 3, skillName: 'Holy Heal',
          });
        default:
          return new AllyHunter(Models.createChaHaeIn(), { name: 'Hunter' });
      }
    },
  };

  global.JejuEntities = Entities;
  global.JejuEntityClasses = { Entity, Player, AntEnemy, AntKing, ShadowSoldier, AllyHunter };
})(typeof window !== 'undefined' ? window : globalThis);
