# JEJU ISLAND RAID — Solo Leveling

A cinematic, browser-playable 3D action game recreating the **Jeju Island Raid** arc from *Solo Leveling*.

You play as **Sung Jin-Woo** (Level 100, Shadow Monarch) during the moment he Shadow-Exchanges onto the forsaken island to save Korea's S-Rank hunters and defeat the **Ant King**.

## Play

Open `index.html` via any static server (required for modules/CDN):

```bash
cd jeju-island-raid
python3 -m http.server 8080
# → http://localhost:8080
```

## Story Structure

| Phase | Location | Objective |
|-------|----------|-----------|
| I | Beach Assault | Land with the Korean Raid Party, clear the ant swarm |
| II | Nest Push | Fight north along the nest path with allies & shadows |
| III | Queen's Chamber | Enter the chamber where the Ant Queen lies dead |
| IV | Ant King | Face the Hidden Boss — poison, ice, gluttony, size morph |
| V | Arise | Extract the Ant King as **Beru** (Marshal Grade) |

## Roster

### Player — Sung Jin-Woo
- **Mutilation** (1) — evolved Critical Attack, multi-slash finisher
- **Dagger Rush** (2) — omni-directional dagger barrage
- **Bloodlust** (3) — fear aura, enemy stats −50%
- **Ruler's Authority** (4) — telekinetic lift & slam
- **Monarch's Domain** (5) — shadow army +50% power
- **Quicksilver** (Q) — speed +30%
- **Stealth** (E) — vanish; next hit crits
- **Shadow Exchange** (R / Space) — teleport via shadows
- **ARISE** (F) — extract fallen enemies into the Shadow Army
- Passives: Detoxification (poison resist), Will to Recover (HP regen)

### Korean Raid Party (AI allies)
| Hunter | Class | Signature |
|--------|-------|-----------|
| Cha Hae-In | Fighter | Sword of Light |
| Baek Yoonho | Fighter | White Tiger transformation |
| Choi Jong-In | Mage | Flame Dragon / Fire Magic |
| Ma Dongwook | Tank | Crushing Blow |
| Lim Tae-Gyu | Archer | Mana Arrow |
| Min Byung-Gyu | Healer | Holy Heal |

### Shadow Army
- **Igris** — Marshal, blood-red knight, greatsword
- **Iron** — Elite Knight tank, tower shield & axe
- **Tank** — Ice Bear, frost claws
- **Tusk** — General shaman, purple magic staff
- **Shadow Soldiers** — infantry (spear / sword / bow)
- **Beru** — unlocked after defeating & extracting the Ant King

### Boss — Ant King
- Immense strength / speed / durability
- **Gluttony** — absorbed skills (poison spit, healing, ice blast, speech)
- **Flight** & wing dive
- **Size Manipulation** — grow & smash
- 3 combat phases with escalating aggression
- Canon line: *"Are there others? Others you call king?"*

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| Mouse / Click canvas | Camera (pointer lock) |
| LMB | Dagger Strike |
| 1–5 | Combat skills |
| Q / E / R / F | Utility & Arise |
| Esc | Pause |
| Scroll | Zoom |

Touch controls appear automatically on mobile.

## Tech

- **Three.js r128** — WebGL 3D, shadows, ACES tone mapping
- Procedural manhwa-accurate character models
- Particle / shockwave / beam / trail VFX engine
- Full HUD: vitals, skill CDs, boss bar, minimap, kill feed, system messages
- No build step — pure HTML/CSS/JS

## Files

```
jeju-island-raid/
├── index.html
├── css/style.css
├── js/models.js      # Character & environment meshes
├── js/vfx.js         # Particles, skills FX
├── js/entities.js    # Combat, AI, skills DB
├── js/game.js        # Engine, world, loop
└── README.md
```
