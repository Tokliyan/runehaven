# RuneHaven

2D persistent open-world isometric survival RPG. Single HTML file
(`runehaven.html`) + Supabase + Netlify. Governed by `RuneHaven_Bible.docx`
(not included here yet — add it to this repo before relying on any automated
build to check bible-fidelity claims itself).

## Layout

```
runehaven.html              the game — currently v16
runehaven-art-style/         SKILL.md — read this before ANY rendering change
debug/run2.js                quick login-screen smoke test
debug/run3.js                REQUIRED full-boot harness (real login, 5 frames)
debug/run4.js                wear-down/taming-gate simulation
debug/run5.js                exhaustive branch-coverage sweep (every class/
                              weapon/armor/species/mob-state combo, once each)
```

Run any harness with: `node debug/runN.js runehaven.html` (or just
`node debug/runN.js` from inside `debug/`, defaulting to `../runehaven.html`).

## The standard process (non-negotiable)

1. **Read `runehaven-art-style/SKILL.md` in full** before touching any
   rendering code, even a small tweak.
2. Apply changes as **surgical, targeted patches** — never a full rewrite of
   a working section. Before any find-and-replace, confirm the anchor string
   is unique in the file (`grep -c "anchor text" runehaven.html` must return
   exactly the number of intended edit sites). An over-broad replace has
   caused a real shipped bug before (v13).
3. **Never invent bible content.** Pets, mobs, biomes, lore, and events must
   come from the bible. If a build needs a value the bible doesn't specify
   (an HP number, a cooldown, a percentage), that's fine to design — but
   flag it as a tunable, and never add a pet/mob/location the bible doesn't
   list without explicitly marking it non-canon.
4. After patching, run in order and require ALL to pass before shipping:
   - `node -e` parse check (`new Function(scriptText)` must not throw)
   - a grep checklist confirming every intended change landed AND every
     prior feature is still present (preservation checks, not just new ones)
   - `node debug/run3.js runehaven.html` — must show `CAUGHT ERROR: none`
   - `node debug/run4.js runehaven.html` — all `PASS`, zero `FAIL`
   - `node debug/run5.js runehaven.html` — must show `CAUGHT: none`
5. **If anything fails, or a patch anchor isn't unique, STOP.** Do not guess,
   do not "fix forward" with more invented content, do not ship a broken
   build. Write a `BUILD_FAILED.md` at the repo root explaining exactly what
   failed and why, and leave `runehaven.html` unchanged.
6. On success: update `runehaven-art-style/SKILL.md` with a new dated
   changelog entry (rendering-scope changes only — mechanics/balance live in
   this README or commit messages, not the skill).
7. Extend `debug/run5.js`'s coverage lists with any new species/mobs/weapon
   kinds/classes added in this build, so future runs keep covering them.

## Confirmed, locked spec for the next build (v18 — Underground + Underwater Caves, 5 new species)

v17 (Enchanted Forest / Sacred Meadow / Stag / Unicorn / Lightfox) shipped
successfully. This section replaces the v17 entry as the current locked
target. Do not redesign the numbers or mechanics below — implement exactly
as written.

**PART A — density pass (do this first, before any new content).** Current
overworld spawn counts were never tuned with visual density in mind and the
island is reading as cluttered. Reduce every existing MOBS and
WILD_SPECIES `count` value by roughly 30-40%, rounding down, minimum 1.
Exact target: goblin 5→3, bandit 4→3, troll 3→2, boar 3→2, bear 3→2,
griffin 2→1, phoenix 2→1, wolf/golem/shadowfox and the four sprites: reduce
similarly by ~35% each, minimum 1. This is a pure tuning change — do not
touch spawn logic, biome gating, or placement algorithms, only the count
numbers. Confirm via `run5`'s existing render-coverage sweep that every
species/mob still renders at least once (a lower count must never drop a
species to zero spawns in the test seed).

**PART B — cave access: Underground and Underwater Caves are separate
interior spaces, not more overworld tiles.** This directly matters for the
density problem above — do not place any new content as additional
overworld decor. Underground Caves: an entrance point placed on ROCK or
PEAK terrain (reuse the existing ruin/landmark placement pattern already in
the world-build code — search for how the Ruins or Ancient Forge landmark
picks its position — do not invent a new placement method), leading into a
separate enclosed interior area, not part of the 80x80 overworld grid.
Underwater Caves: reuse the breath-timer dive mechanic and the health-regen
item already agreed for underwater access — the entrance is a dive point in
deep water, leading to its own separate interior area, same architecture as
the underground entrance. Both interiors can be modest single rooms/short
corridors for this version — the point is establishing the access pattern
and giving these 5 species real places to exist, not building a sprawling
dungeon crawl (that's Dungeons, a later version).

**PART C — five new species.**

*Pets (passive taming, existing v12 formula):*

| Pet | Rarity | Where | Tame base chance |
|---|---|---|---|
| Water Dragon | Rare | Underwater Caves, tame as hatchling | 0.25 |
| Fire Dragon | Rare | Underground Caves (lava sub-area), tame as hatchling | 0.25 |
| Glow Moth | Common | Underground Caves (and Dungeons later — Underground only this version) | 0.65 |

Combat stats — Water/Fire Dragon already locked from the v16 table, just
attach them: 55 HP / 12 dmg / 1.6s cooldown / PvP-capable (Rare rarity,
matches Unicorn's Rare-tier PvP gating). Glow Moth: NO combat role, matches
the original Common-tier rule (Sprites + Glow Moth = no combat) — do not
give it HP/dmg/cooldown stats at all.

**Glow Moth's actual function — a new mechanic, not combat:** when active,
it should light the area around the player — a soft radius, most
noticeable inside the new cave interiors and at night. Reuse the existing
warm-glow gradient language already in its own art (the radial gradient
already in the ported code below) as the light's visual source; the
mechanic itself is new — a small local light radius increase around the
player while this pet is active. Keep it simple: no stacking with other
light sources, no separate toggle, just "on while active."

*Mobs (kill-for-loot, existing v13 mob framework, tameable:false):*

| Mob | Difficulty | Where | HP | Dmg | Windup | Notes |
|---|---|---|---|---|---|---|
| Dark Wraith | Medium | Dark Forest only this version (bible also lists Dungeons — defer that spawn until Dungeons exist, a later version) | 65 | 12 | 600ms | Ranged spectral attack, not melee lunge — thematically appropriate for an incorporeal enemy. Reuse the existing ranged-mob pattern if one exists in the mob framework; if not, a short-range bolt is fine, flag the exact mechanism used |
| Sea Serpent | Hard | Underwater Caves interior | 130 | 18 | 700ms | Standard melee-range mob framework, just bigger numbers than Troll |

Both use the existing MOBS table shape exactly (hp/dmg/atkRange/
atkCooldownMs/windupMs/aggroRadius/leashRadius/moveSpeed/count/tameable/
loot) — Dark Wraith drops runic materials (reuse the existing runic_stone
item), Sea Serpent drops "rare aquatic loot" — since no aquatic-specific
loot item exists yet, use existing materials (iron_bar/runic_stone) at a
generous drop rate rather than inventing a new item type; a dedicated
aquatic loot item can be designed later if actually needed.

**Mounts:** Water Dragon and Fire Dragon are both on the bible's mountable
list. DEFERRED, same as v16/v17 — no riding code, they inherit the
speed bonus automatically whenever full mounting ships.

**Art — already designed and ported for you, ready to insert.** Same
convention as v15/v17 (P/R/EY/BND/SCL/drawBlobLocal — confirmed already
present in the file, verified directly before writing this spec). One new
piece of shared infrastructure this version: the `aura()` helper function
does NOT exist yet anywhere in the file — insert it exactly as given below,
once, near the other rendering helpers (alongside P/R/EY/BND/SCL is a
sensible spot). It is used by Dark Wraith's art and will be reused by
future Elder-tier content, so this is worth getting right now.

Also new: `dragonV2()` is a SHARED body function used by both Water Dragon
and Fire Dragon (and will be reused again when Storm/Shadow Dragons are
built in a later version — the palette table below already includes their
colors even though only `water`/`fire` are wired into `drawSpecies` this
version, so no rework is needed later). Insert `dragonV2()` once as its own
top-level function, insert `DRAGON_PAL` once as its own top-level constant,
then call it from within the `drawSpecies` branches for `water_dragon` and
`fire_dragon`.

```js
// ============ 1. aura() — new shared helper, insert once ============
function aura(sx, sy, col, rx, t, o) {
  o = o || {};
  const rgb = col;
  const pulse = 0.45 + Math.sin(t / (o.speed || 340)) * 0.28;
  const g = ctx.createRadialGradient(sx, sy - rx * 0.5, 1, sx, sy - rx * 0.5, rx * 1.5);
  g.addColorStop(0, `rgba(${rgb},${0.26 * pulse})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(sx - rx * 1.6, sy - rx * 2.2, rx * 3.2, rx * 3.2);
  ctx.strokeStyle = `rgba(${rgb},${pulse})`;
  ctx.lineWidth = o.lw || 1.4;
  ctx.beginPath();
  ctx.ellipse(sx, sy + 1, rx + Math.sin(t / 340) * 1.6, (rx + Math.sin(t / 340) * 1.6) * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  const n = o.motes === undefined ? 4 : o.motes;
  for (let i = 0; i < n; i++) {
    const ph = (t / (o.riseMs || 900) + i / n) % 1;
    const fy = sy - 2 - ph * rx * 2.4;
    const fx = sx + Math.sin(t / 500 + i * 2.3) * rx * 0.7;
    const a = 0.75 * (1 - ph);
    const s = o.moteSize || 2.2;
    ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.beginPath();
    ctx.moveTo(fx, fy - s); ctx.lineTo(fx + s * 0.7, fy); ctx.lineTo(fx, fy + s); ctx.lineTo(fx - s * 0.7, fy);
    ctx.closePath(); ctx.fill();
  }
}

// ============ 2. DRAGON_PAL — new shared constant, insert once ============
const DRAGON_PAL = {
  water:  { lit:"#4aa8b6", mid:"#2f7c8c", belly:"#bfe4ec", bandLine:"#8ec6d4", scale:"#3c93a2", ridge:"#9fe0ec", head:"#4aa8b6", horn:"#2a6472", hornLit:"#67c2d0", wing:"#63c6d2", wingMid:"#3f9aa8", wingDark:"#367f8e", bone:"#a8dce6", boneDark:"#4e8e9c", claw:"#e2f2f6", eye:"#eafcff", pupil:"#123840" },
  fire:   { lit:"#c2482c", mid:"#8f2c1a", belly:"#f0b48a", bandLine:"#d08a5c", scale:"#a83a22", ridge:"#ffb14c", head:"#c2482c", horn:"#5e1e10", hornLit:"#e8804a", wing:"#e0663a", wingMid:"#b0402a", wingDark:"#8a2c1c", bone:"#f4b48a", boneDark:"#7a2612", claw:"#ffe0b4", eye:"#ffe08a", pupil:"#3a1004" },
  storm:  { lit:"#5f61a2", mid:"#3f4074", belly:"#c6cbee", bandLine:"#9498cc", scale:"#4e5090", ridge:"#a8c4f0", head:"#5f61a2", horn:"#2e2f5c", hornLit:"#8a8cd0", wing:"#8286c8", wingMid:"#5a5c9a", wingDark:"#454778", bone:"#cdd2f4", boneDark:"#4a4c86", claw:"#e8ecff", eye:"#e8f0ff", pupil:"#1c1e3c" },
  shadow: { lit:"#3a3450", mid:"#241f36", belly:"#6a5f86", bandLine:"#4c4368", scale:"#2e2842", ridge:"#7a5ca8", head:"#3a3450", horn:"#191426", hornLit:"#5e4c86", wing:"#4e4470", wingMid:"#332c4c", wingDark:"#241f36", bone:"#7e6ea8", boneDark:"#2a2440", claw:"#c8b4e8", eye:"#c08cf0", pupil:"#1a1026" },
};

// ============ 3. dragonV2() — new shared function, insert once ============
function dragonV2(sx, sy, P, t, variant, S) {
  S = S || 1;
  const F = Math.sin(t / 340) * 3 * S;
  const X = (v) => sx + v * S, Y = (v) => sy + v * S;

  P(ctx, [X(-1), Y(-14), X(-15), Y(-22 - F / S), X(-19), Y(-11 - F / S), X(-7), Y(-9)], P.wingDark);
  R(ctx, [X(-1), Y(-14), X(-15), Y(-22 - F / S)], P.boneDark, 1.1 * S);
  R(ctx, [X(-2), Y(-13), X(-17), Y(-16 - F / S)], P.boneDark, 0.9 * S);

  P(ctx, [X(-6), Y(-2), X(-16), Y(-5 + Math.sin(t / 300) * 1.4), X(-15), Y(-1.5), X(-5), Y(-5)], P.mid);
  P(ctx, [X(-16), Y(-5 + Math.sin(t / 300) * 1.4), X(-21), Y(-8 + Math.sin(t / 300) * 2), X(-18), Y(-2)], P.lit);
  for (let i = 0; i < 4; i++) {
    P(ctx, [X(-7 - i * 2.4), Y(-4 - i * 0.3), X(-8 - i * 2.4), Y(-7 - i * 0.5), X(-9.4 - i * 2.4), Y(-4.2 - i * 0.3)], P.ridge);
  }

  P(ctx, [X(-5), Y(0), X(-6.4), Y(-7), X(-2), Y(-7.6), X(-1.4), Y(0)], P.mid);
  P(ctx, [X(-6.6), Y(0), X(-3), Y(0), X(-3), Y(-1.6), X(-7.2), Y(-1.2)], P.claw);

  P(ctx, [X(-6), Y(-6), X(-5), Y(-14), X(4), Y(-14.6), X(6), Y(-6)], P.lit);
  P(ctx, [X(4), Y(-14.6), X(6), Y(-6), X(-6), Y(-6), X(-0.5), Y(-9)], P.mid);
  P(ctx, [X(-5), Y(-6), X(5.4), Y(-6), X(4.4), Y(-1.4), X(-4), Y(-1.4)], P.belly);
  BND(ctx, X(-3.8), X(4.2), Y(-5), 4, 1.1 * S, P.bandLine, 0.6 * S);
  SCL(ctx, X(-4.6), Y(-13.4), 9 * S, 6 * S, P.scale, 2.3 * S);

  P(ctx, [X(2.4), Y(0), X(1.6), Y(-7.4), X(5.4), Y(-7.8), X(5.8), Y(0)], P.lit);
  P(ctx, [X(1.4), Y(0), X(6), Y(0), X(6), Y(-1.8), X(1.2), Y(-1.4)], P.claw);

  P(ctx, [X(1.6), Y(-13), X(3), Y(-22), X(6.4), Y(-21.4), X(5), Y(-12.4)], P.lit);
  P(ctx, [X(5), Y(-12.4), X(6.4), Y(-21.4), X(7), Y(-20.6), X(6), Y(-12)], P.mid);
  for (let i = 0; i < 4; i++) {
    P(ctx, [X(2.6 + i * 0.3), Y(-14.4 - i * 2), X(1.4 + i * 0.3), Y(-16.4 - i * 2), X(3.4 + i * 0.3), Y(-16.2 - i * 2)], P.ridge);
  }

  P(ctx, [X(2.8), Y(-22.6), X(10), Y(-23.6), X(10.4), Y(-18.6), X(3), Y(-18)], P.head);
  P(ctx, [X(10), Y(-23.6), X(10.4), Y(-18.6), X(6.4), Y(-18.4)], P.mid);
  P(ctx, [X(10.2), Y(-22.6), X(14.4), Y(-20.8), X(10.4), Y(-19)], P.head);
  P(ctx, [X(10.2), Y(-19.6), X(14.2), Y(-20.4), X(13.8), Y(-18.6), X(10.3), Y(-18.4)], P.mid);
  P(ctx, [X(3.4), Y(-23.4), X(9.6), Y(-24.2), X(9.2), Y(-22.4), X(3.6), Y(-22)], P.ridge);
  ctx.fillStyle = "#f4f0e0";
  for (let i = 0; i < 3; i++) ctx.fillRect(X(11 + i * 1.2), Y(-19.4), 0.7 * S, 1.1 * S);
  ctx.fillStyle = P.nostril || P.mid;
  ctx.fillRect(X(13), Y(-21.4), 1 * S, 0.9 * S);
  EY(ctx, X(8), Y(-22.2), 1.5 * S, P.eye, P.pupil);

  P(ctx, [X(4), Y(-23.8), X(1.6), Y(-30), X(5.8), Y(-24.4)], P.horn);
  P(ctx, [X(6), Y(-24.2), X(4.6), Y(-31.4), X(7.8), Y(-24.6)], P.hornLit);
  P(ctx, [X(3.2), Y(-23.4), X(0.4), Y(-26.6), X(3.4), Y(-22.4)], P.horn);

  P(ctx, [X(1), Y(-14), X(-11), Y(-25 - F / S), X(-16), Y(-12 - F / S), X(-4), Y(-8.4)], P.wing);
  P(ctx, [X(-11), Y(-25 - F / S), X(-16), Y(-12 - F / S), X(-9), Y(-15)], P.wingMid);
  R(ctx, [X(1), Y(-14), X(-11), Y(-25 - F / S)], P.bone, 1.2 * S);
  R(ctx, [X(0), Y(-13), X(-13.4), Y(-19 - F / S)], P.bone, 1 * S);
  R(ctx, [X(-0.6), Y(-12), X(-14.6), Y(-13.6 - F / S)], P.bone, 0.9 * S);
  P(ctx, [X(-11), Y(-25 - F / S), X(-13.4), Y(-27.4 - F / S), X(-12.6), Y(-24 - F / S)], P.claw);

  if (variant === "water") {
    P(ctx, [X(3), Y(-23.8), X(0.6), Y(-28.6), X(5), Y(-24.6)], "#9fe0ec");
    P(ctx, [X(-2), Y(-14.6), X(-5.4), Y(-19), X(-0.4), Y(-15.4)], "#9fe0ec");
    for (let i = 0; i < 3; i++) {
      const ph = (t / 700 + i * 0.33) % 1;
      ctx.fillStyle = `rgba(180,236,248,${0.6 * (1 - ph)})`;
      ctx.beginPath(); ctx.arc(X(15 + ph * 6), Y(-20.6 + Math.sin(t / 260 + i) * 2), 1.2 * S, 0, Math.PI * 2); ctx.fill();
    }
  } else if (variant === "fire") {
    for (let i = 0; i < 4; i++) {
      const ph = (t / 420 + i * 0.26) % 1;
      ctx.fillStyle = `rgba(255,${140 + i * 22},50,${0.8 * (1 - ph)})`;
      ctx.fillRect(X(14.6 + ph * 8), Y(-21 + Math.sin(t / 200 + i * 2) * 2.2), 1.8 * S, 1.8 * S);
    }
  } else if (variant === "storm") {
    ctx.strokeStyle = "#dceaff"; ctx.lineWidth = 1.2 * S;
    const zz = Math.sin(t / 160) > 0.4 ? 1 : 0.25;
    ctx.globalAlpha = zz;
    ctx.beginPath();
    ctx.moveTo(X(2), Y(-30)); ctx.lineTo(X(4.6), Y(-33.4)); ctx.lineTo(X(3), Y(-33)); ctx.lineTo(X(5.6), Y(-36.4));
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (variant === "shadow") {
    for (let i = 1; i <= 3; i++) {
      ctx.fillStyle = `rgba(50,38,72,${0.22 / i})`;
      const off = i * 5 * S;
      P(ctx, [X(-6) - off, Y(-2), X(-3) - off, Y(-9), X(-1) - off, Y(-1)], `rgba(56,44,80,${0.26 / i})`);
    }
  }
}

// ============ 4. drawSpecies branches — insert into the existing chain ============
else if (species === "water_dragon") {
  dragonV2(sx, sy, DRAGON_PAL.water, t, "water");
}
else if (species === "fire_dragon") {
  dragonV2(sx, sy, DRAGON_PAL.fire, t, "fire");
}
else if (species === "glow_moth") {
    const g = ctx.createRadialGradient(sx, sy - 10, 1, sx, sy - 10, 17);
    g.addColorStop(0, "rgba(244,232,160,0.5)"); g.addColorStop(1, "rgba(244,232,160,0)");
    ctx.fillStyle = g; ctx.fillRect(sx - 17, sy - 27, 34, 34);
    const fl = Math.sin(t / 150) * 3.4;
    P(ctx, [sx - 1, sy - 11, sx - 12, sy - 18 - fl, sx - 9, sy - 6, sx - 2.6, sy - 7], "#c9b96c");
    P(ctx, [sx + 1, sy - 11, sx + 12, sy - 18 - fl, sx + 9, sy - 6, sx + 2.6, sy - 7], "#b0a05a");
    P(ctx, [sx - 1, sy - 13, sx - 10, sy - 20 + fl * 0.4, sx - 3, sy - 10], "#f4ebb4");
    P(ctx, [sx + 1, sy - 13, sx + 10, sy - 20 + fl * 0.4, sx + 3, sy - 10], "#ded27f");
    ctx.fillStyle = "rgba(255,250,214,0.9)";
    ctx.beginPath(); ctx.arc(sx - 6.4, sy - 15.4, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 6.4, sy - 15.4, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8a7a4c";
    ctx.beginPath(); ctx.arc(sx - 6.4, sy - 15.4, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 6.4, sy - 15.4, 0.6, 0, Math.PI * 2); ctx.fill();
    P(ctx, [sx - 1.7, sy - 16, sx + 1.7, sy - 16, sx + 1.2, sy - 6, sx - 1.2, sy - 6], "#7a6a40");
    ctx.fillStyle = "#fff6c4";
    ctx.fillRect(sx - 1.1, sy - 10.4, 2.2, 4);
    drawBlobLocal(ctx, sx, sy - 17, 1.8, "#a89658");
    ctx.strokeStyle = "#6e5f38"; ctx.lineWidth = 0.7; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx - 0.8, sy - 18.2); ctx.quadraticCurveTo(sx - 4, sy - 22, sx - 6.4, sy - 21);
    ctx.moveTo(sx + 0.8, sy - 18.2); ctx.quadraticCurveTo(sx + 4, sy - 22, sx + 6.4, sy - 21);
    ctx.stroke(); ctx.lineCap = "butt";
}

// ============ 5. drawMob branches — insert into the existing chain ============
else if (kind === "dark_wraith") {
    aura(sx, sy, "110,80,170", 10, t, { motes: 3, moteSize: 1.8, lw: 1 });
    ctx.globalAlpha = 0.86;
    const drift = Math.sin(t / 620) * 1.4;
    for (let i = 0; i < 5; i++) {
      const w = Math.sin(t / 300 + i * 1.4) * 1.6;
      P(ctx, [sx - 6 + i * 3, sy - 8 + drift, sx - 7.4 + i * 3 + w, sy + 1 + drift, sx - 3.6 + i * 3 + w, sy - 0.6 + drift],
           i % 2 ? "#2e2444" : "#3c3058");
    }
    P(ctx, [sx - 6.4, sy - 8 + drift, sx - 5, sy - 18 + drift, sx + 4.6, sy - 18.6 + drift, sx + 6.4, sy - 8 + drift], "#3c3058");
    P(ctx, [sx + 4.6, sy - 18.6 + drift, sx + 6.4, sy - 8 + drift, sx - 6.4, sy - 8 + drift, sx - 0.4, sy - 11 + drift], "#241c36");
    P(ctx, [sx - 5, sy - 18 + drift, sx - 1.4, sy - 20.4 + drift, sx + 2, sy - 20.2 + drift, sx + 4.6, sy - 18.6 + drift], "#4e4074");
    P(ctx, [sx - 3.6, sy - 18.4 + drift, sx - 2.6, sy - 12.6 + drift, sx + 2.6, sy - 12.8 + drift, sx + 3.6, sy - 18.6 + drift], "#120e1c");
    const gp = 0.55 + Math.sin(t / 260) * 0.4;
    ctx.fillStyle = `rgba(180,120,255,${gp})`;
    ctx.fillRect(sx - 2, sy - 16.6 + drift, 1.6, 1.6);
    ctx.fillRect(sx + 0.6, sy - 16.6 + drift, 1.6, 1.6);
    ctx.fillStyle = `rgba(180,120,255,${gp * 0.28})`;
    ctx.fillRect(sx - 3, sy - 17.6 + drift, 3.6, 3.6);
    ctx.fillRect(sx - 0.4, sy - 17.6 + drift, 3.6, 3.6);
    ctx.strokeStyle = "#c4b8dc"; ctx.lineWidth = 0.8; ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + 6.4, sy - 12 + drift);
      ctx.lineTo(sx + 9.4 + i * 0.8, sy - 13.6 - i * 1.2 + drift);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const ph = (t / 800 + i * 0.34) % 1;
      ctx.fillStyle = `rgba(150,110,220,${0.55 * (1 - ph)})`;
      ctx.fillRect(sx - 7 + i * 7, sy - 14 - ph * 12 + drift, 1.6, 1.6);
    }
}
else if (kind === "sea_serpent") {
    const w1 = Math.sin(t / 420) * 1.6, w2 = Math.sin(t / 420 + 1.2) * 1.6;
    P(ctx, [sx - 22, sy, sx - 19, sy - 6 + w1, sx - 13, sy - 6.4 + w1, sx - 10, sy], "#2f7c8c");
    P(ctx, [sx - 19, sy - 6 + w1, sx - 13, sy - 6.4 + w1, sx - 14, sy - 2], "#1e5a68");
    P(ctx, [sx - 9, sy, sx - 6, sy - 7 + w2, sx + 1, sy - 7.4 + w2, sx + 4, sy], "#3f9aa8");
    P(ctx, [sx - 6, sy - 7 + w2, sx + 1, sy - 7.4 + w2, sx - 1, sy - 2], "#25687a");
    SCL(ctx, sx - 20, sy - 5.4 + w1, 8, 4, "#25687a", 2.2);
    SCL(ctx, sx - 7, sy - 6.4 + w2, 9, 4.6, "#2a7284", 2.2);
    for (let i = 0; i < 3; i++) {
      P(ctx, [sx - 18 + i * 2.6, sy - 6 + w1, sx - 19 + i * 2.6, sy - 10.4 + w1, sx - 16 + i * 2.6, sy - 6.2 + w1], "#9fe0ec");
    }
    for (let i = 0; i < 3; i++) {
      P(ctx, [sx - 5 + i * 2.6, sy - 7 + w2, sx - 6 + i * 2.6, sy - 11.6 + w2, sx - 3 + i * 2.6, sy - 7.2 + w2], "#9fe0ec");
    }
    P(ctx, [sx - 23, sy - 1.4, sx - 29.4, sy - 5.4 + Math.sin(t / 380) * 2, sx - 22.4, sy - 5], "#2f7c8c");
    P(ctx, [sx - 29.4, sy - 5.4 + Math.sin(t / 380) * 2, sx - 33.4, sy - 2 + Math.sin(t / 380) * 2, sx - 30, sy - 9 + Math.sin(t / 380) * 2], "#9fe0ec");
    P(ctx, [sx + 1.4, sy - 7, sx + 3.4, sy - 19.4, sx + 7, sy - 19, sx + 5.4, sy - 6.4], "#3f9aa8");
    P(ctx, [sx + 5.4, sy - 19, sx + 7, sy - 19, sx + 6.4, sy - 6.6], "#25687a");
    for (let i = 0; i < 4; i++) {
      P(ctx, [sx + 3.2 - i * 0.2, sy - 17.4 + i * 2.6, sx + 1.4 - i * 0.2, sy - 19.4 + i * 2.6, sx + 3.6 - i * 0.2, sy - 15.4 + i * 2.6], "#9fe0ec");
    }
    P(ctx, [sx + 3.2, sy - 19.8, sx + 11, sy - 21.2, sx + 11.4, sy - 15.6, sx + 3.4, sy - 14.8], "#4aa8b6");
    P(ctx, [sx + 11, sy - 21.2, sx + 11.4, sy - 15.6, sx + 7, sy - 15.4], "#25687a");
    P(ctx, [sx + 11.2, sy - 20.2, sx + 16.4, sy - 18.2, sx + 11.4, sy - 16.2], "#3f9aa8");
    ctx.fillStyle = "#f4f0e0";
    for (let i = 0; i < 4; i++) ctx.fillRect(sx + 12 + i * 1.3, sy - 17.2, 0.8, 1.4);
    P(ctx, [sx + 3.8, sy - 21, sx + 9.6, sy - 22.2, sx + 9.2, sy - 20, sx + 4, sy - 19.4], "#67c2d0");
    EY(ctx, sx + 8.4, sy - 19.8, 1.5, "#eafcff", "#0e3a44");
    P(ctx, [sx + 4, sy - 22, sx + 2.2, sy - 27.4, sx + 6, sy - 22.6], "#9fe0ec");
    P(ctx, [sx + 6, sy - 22.6, sx + 7.4, sy - 28.4, sx + 9.4, sy - 22], "#bfeef6");
    P(ctx, [sx + 9.4, sy - 22, sx + 12, sy - 26.4, sx + 11.4, sy - 21], "#9fe0ec");
    for (let i = 0; i < 3; i++) {
      const ph = (t / 900 + i * 0.34) % 1;
      ctx.strokeStyle = `rgba(200,240,250,${0.5 * (1 - ph)})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(sx + 14 + i * 3, sy - 22 - ph * 10, 1.4, 0, Math.PI * 2); ctx.stroke();
    }
}
```

After inserting, add `water_dragon`, `fire_dragon`, `glow_moth` to
`SPECIES_K` (Rare dragons: 1.30 each, matching the already-approved
reference-sheet scale for hatchling dragons; Glow Moth: 0.32, small).
Add `dark_wraith`, `sea_serpent` to `MOB_K` (Dark Wraith: 1.30, human-ish
scale; Sea Serpent: 2.60, large — this is a big creature) and `MOB_TALL`
(Dark Wraith: 4; Sea Serpent: 15 — its body is wide and low, tune the exact
overlay-offset value against how it actually renders, this is a starting
estimate not a hard requirement).

**Proof gates — standard gauntlet plus:**
- Extend `run4.js` with assertions for all 5 species (stats match the
  tables above exactly; Glow Moth confirmed to have no combat capability at
  all, not just zero stats but no combat code path triggering for it).
- Extend `run5.js`'s coverage sweep to include all 5 new species/mobs.
- Confirm via a quick check that both new cave interiors are actually
  reachable from the entrances placed in the overworld (not literally the
  full worldgen sanity check from v17, just confirm the entrance→interior
  transition exists and doesn't error).
- Confirm the density-reduction pass (Part A) didn't drop any species to
  zero spawns anywhere in the test seed.

**Explicitly not touched this version:** Dungeons (later version — this is
also when Dark Wraith's second spawn location and Demon Knight arrive),
Storm/Shadow Dragons (later version, though their palette data is now
pre-staged), mounting/riding (still future), a dedicated aquatic loot item
(design later if actually needed), full dungeon-crawl depth for the two new
cave interiors (this version just establishes access + a home for these 5
species).

**After v18 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target, exactly as before.
