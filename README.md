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

## Confirmed, locked spec for the next build (v17 — Enchanted Forest, Sacred Meadow, 3 pets)

v16 (pet combat) shipped successfully — see the changelog in runehaven-art-style/SKILL.md. This section replaces the old v16 entry as the current locked target. Do not redesign the numbers or mechanics below — implement exactly as written, same as v16.

Biomes: two rarer-variant biomes, following the exact same pattern already used for Dark Forest (a rarer pocket embedded within an existing biome via the hashed-patch technique already in the world-build code — search for how Dark Forest is generated and mirror that approach, do not invent a new worldgen method). Enchanted Forest is a rarer pocket within Forest tiles (shimmering palette: bioluminescent undergrowth, drifting motes using the same particle language as existing magic effects, desaturated canopy so the glow reads). Sacred Meadow is a rarer pocket within Meadow tiles (golden/dawn palette, warm grass, soft light-shaft treatment). Tune hash thresholds to a density similar to Dark Forest's — match the existing constant, do not guess a wildly different rarity.

New resource (gatherable only, no crafting use yet): rare_herb and magic_essence as new stackable ground items, gatherable via the existing E-to-pick-up flow (same pattern as ore). Do NOT design any crafting recipe or consumable effect for these — the bible mentions them but defines no use, and inventing one would violate the no-guessing rule. They exist purely as collectible items this version; their purpose gets designed later once actually needed.

Three new pets — all PASSIVE taming (hold-E channel, the existing v12 formula: tameChanceFor, bait/bond/Beastmaster/shrine/blood, clamped 5–95%). None of these are fight-to-tame; the bible never says "fight" for any of the three.

Pet	Rarity	Where/when	Tame base chance
Stag	Uncommon	Enchanted Forest	0.45
Unicorn	Rare	Deep Enchanted Forest, night only	0.25
Lightfox	Epic	Sacred Meadow, dawn only, chance spawn	0.20

Combat stats for these three are already locked from the v16 spec table — do not redesign them, just attach them to the new species:

Stag: 25 HP / 3 dmg / 1.8s cooldown / not PvP-capable (Uncommon rarity)
Unicorn: 45 HP / 8 dmg / 1.6s cooldown / PvP-capable (Rare rarity)
Lightfox: 50 HP / 10 dmg / 1.3s cooldown / PvP-capable (Epic rarity, same tier as Shadowfox)

Unicorn gating: reuse the exact existing Shadowfox pattern — nightOnly: true plus a presenceRoll (Shadowfox uses 0.55; use the same value unless there's a clear reason not to) so it may not exist some sessions. Restrict spawn biome specifically to Enchanted Forest tiles, not regular Forest.

Lightfox gating — the one genuinely new mechanic: a dawn window, narrower than the existing night check. Target roughly the first 5–8% of the day cycle. Find and read the existing day/night curve function before picking exact bounds — tune against the real curve, don't guess a disconnected time value. Stack a presence-roll chance-spawn on top (same mechanism as Shadowfox/Unicorn), which is why its tame base is the lowest of the three.

Mounts: DEFERRED, same as v16. Stag and Lightfox are on the bible's mountable list; do not build any riding code. They will automatically inherit the already-specified +18% speed bonus whenever mounting ships properly (planned for a future version, full mounting system). Unicorn is NOT on the mountable list — do not add mount capability to it.

Art — already designed and ported for you, ready to insert. These three drawSpecies branches are pixel-accurate ports (same P/R/EY/drawBlobLocal helper convention already used by every other species branch in the file since v15 — search for function P(ctx to confirm those helpers already exist before using them) of approved concept art. Insert them into the existing drawSpecies if/else chain, in the same style as the other branches. Do not redraw or reinterpret this art — insert it as given, adjusting only if a variable name genuinely conflicts with something else in the file (check first; it shouldn't).

js
else if (species === "stag") {
    ctx.strokeStyle = "#8a6f52"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx - 3.8, sy); ctx.lineTo(sx - 3.8, sy - 6);
    ctx.moveTo(sx + 3.2, sy); ctx.lineTo(sx + 3.2, sy - 6); ctx.stroke();
    ctx.fillStyle = "#2e2418";
    ctx.fillRect(sx - 4.4, sy - 1, 1.4, 1); ctx.fillRect(sx + 2.6, sy - 1, 1.4, 1);
    P(ctx, [sx - 5, sy - 5.6, sx - 3.8, sy - 12.4, sx + 3.6, sy - 13, sx + 4.8, sy - 5.6], "#c49a68");
    P(ctx, [sx + 3.6, sy - 13, sx + 4.8, sy - 5.6, sx - 5, sy - 5.6, sx - 0.4, sy - 7.6], "#8a6842");
    ctx.fillStyle = "#e8dcc4";
    ctx.fillRect(sx - 2.6, sy - 10.4, 1.2, 1.2); ctx.fillRect(sx + 0.4, sy - 11, 1.2, 1.2);
    ctx.fillRect(sx - 1, sy - 8.6, 1, 1); ctx.fillRect(sx + 2, sy - 9, 1, 1);
    P(ctx, [sx + 2.4, sy - 12.4, sx + 3.8, sy - 18.4, sx + 6.4, sy - 18.2, sx + 5, sy - 11.6], "#c49a68");
    P(ctx, [sx + 3.8, sy - 18.6, sx + 9, sy - 19.6, sx + 9.2, sy - 15.6, sx + 4, sy - 15], "#d2a874");
    P(ctx, [sx + 9, sy - 19.6, sx + 9.2, sy - 15.6, sx + 6, sy - 15.4], "#96724a");
    P(ctx, [sx + 9.1, sy - 18.6, sx + 11.8, sy - 17.4, sx + 9.2, sy - 16], "#8a6842");
    ctx.fillStyle = "#241a10"; ctx.fillRect(sx + 10.8, sy - 17.6, 0.9, 0.9);
    EY(ctx, sx + 7.2, sy - 18, 1, "#e8dcc4", "#2e2418");
    P(ctx, [sx + 4, sy - 19.6, sx + 3.4, sy - 22.4, sx + 5.6, sy - 19.6], "#96724a");
    P(ctx, [sx + 7, sy - 19.6, sx + 8.6, sy - 22.2, sx + 9, sy - 19.4], "#96724a");
    ctx.strokeStyle = "#e0d0b0"; ctx.lineWidth = 1.3; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx + 4.8, sy - 20.4); ctx.lineTo(sx + 3.4, sy - 24.4); ctx.lineTo(sx + 4.2, sy - 27.6);
    ctx.moveTo(sx + 3.8, sy - 22.6); ctx.lineTo(sx + 0.6, sy - 24);
    ctx.moveTo(sx + 3.4, sy - 24.4); ctx.lineTo(sx + 0.8, sy - 26.6);
    ctx.moveTo(sx + 4, sy - 26.4); ctx.lineTo(sx + 2, sy - 28.8);
    ctx.moveTo(sx + 7.4, sy - 20.6); ctx.lineTo(sx + 8.8, sy - 24.6); ctx.lineTo(sx + 8, sy - 27.8);
    ctx.moveTo(sx + 8.4, sy - 22.8); ctx.lineTo(sx + 11.6, sy - 24.2);
    ctx.moveTo(sx + 8.8, sy - 24.6); ctx.lineTo(sx + 11.4, sy - 26.8);
    ctx.moveTo(sx + 8.2, sy - 26.6); ctx.lineTo(sx + 10.2, sy - 29);
    ctx.stroke(); ctx.lineCap = "butt";
    P(ctx, [sx - 4.8, sy - 10.4, sx - 7.6, sy - 13.6 + Math.sin(t / 400), sx - 3.8, sy - 12], "#e8dcc4");
}


else if (species === "unicorn") {
    ctx.strokeStyle = "#e0dad0"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy); ctx.lineTo(sx - 4, sy - 6.4);
    ctx.moveTo(sx + 3.4, sy); ctx.lineTo(sx + 3.4, sy - 6.4); ctx.stroke();
    ctx.fillStyle = "#c8bca8";
    ctx.fillRect(sx - 4.7, sy - 1.2, 1.6, 1.2); ctx.fillRect(sx + 2.7, sy - 1.2, 1.6, 1.2);
    P(ctx, [sx - 5.4, sy - 6, sx - 4.2, sy - 13.4, sx + 4.2, sy - 14, sx + 5.2, sy - 6], "#f8f5ef");
    P(ctx, [sx + 4.2, sy - 14, sx + 5.2, sy - 6, sx - 5.4, sy - 6, sx - 0.4, sy - 8.2], "#cdc6bc");
    P(ctx, [sx - 4.2, sy - 13.4, sx - 1, sy - 14.4, sx + 0.4, sy - 10, sx - 4.6, sy - 9], "#ffffff");
    P(ctx, [sx + 2.8, sy - 13.4, sx + 4.2, sy - 19.8, sx + 7, sy - 19.6, sx + 5.4, sy - 12.6], "#f8f5ef");
    P(ctx, [sx + 4.2, sy - 20, sx + 9.6, sy - 21, sx + 9.8, sy - 16.8, sx + 4.4, sy - 16.2], "#ffffff");
    P(ctx, [sx + 9.6, sy - 21, sx + 9.8, sy - 16.8, sx + 6.4, sy - 16.6], "#d6cfc4");
    P(ctx, [sx + 9.7, sy - 20, sx + 12.4, sy - 18.6, sx + 9.8, sy - 17.2], "#dcd4c8");
    ctx.fillStyle = "#8a8290"; ctx.fillRect(sx + 11.4, sy - 18.8, 0.9, 0.9);
    EY(ctx, sx + 7.6, sy - 19.4, 1.1, "#e8e0f4", "#3a3444");
    P(ctx, [sx + 4.4, sy - 21, sx + 4, sy - 23.8, sx + 5.8, sy - 21], "#d6cfc4");
    P(ctx, [sx + 7, sy - 21, sx + 8.4, sy - 23.6, sx + 8.8, sy - 20.8], "#d6cfc4");
    ctx.strokeStyle = "#f4e6b0"; ctx.lineWidth = 1.7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(sx + 8.4, sy - 21.6); ctx.lineTo(sx + 11.6, sy - 29.6); ctx.stroke();
    ctx.strokeStyle = "#c8a862"; ctx.lineWidth = 0.65;
    for (let i = 0; i < 5; i++) {
      const f = i / 5;
      ctx.beginPath();
      ctx.moveTo(sx + 8.5 + f * 3, sy - 22.4 - f * 7.2);
      ctx.lineTo(sx + 9.7 + f * 2.6, sy - 22.9 - f * 7.2);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    for (let i = 0; i < 4; i++) {
      P(ctx, [sx + 3.4 - i * 0.7, sy - 20 + i * 1.7, sx + 0.4 - i * 0.5, sy - 16.4 + i * 1.6, sx + 4.6 - i * 0.6, sy - 15.4 + i * 1.6], i % 2 ? "#e8def4" : "#f4ecfa");
    }
    P(ctx, [sx - 5.2, sy - 11.4, sx - 9.8, sy - 15.4 + Math.sin(t / 420) * 1.2, sx - 4, sy - 13], "#f4ecfa");
}


else if (species === "lightfox") {
    const g = ctx.createRadialGradient(sx, sy - 7, 1, sx, sy - 7, 20);
    g.addColorStop(0, "rgba(255,238,176,0.3)"); g.addColorStop(1, "rgba(255,238,176,0)");
    ctx.fillStyle = g; ctx.fillRect(sx - 20, sy - 28, 40, 34);
    P(ctx, [sx - 7.4, sy, sx - 5.4, sy - 8.4, sx + 3.4, sy - 8, sx + 5.4, sy], "#f6e4ac");
    P(ctx, [sx + 3.4, sy - 8, sx + 5.4, sy, sx - 7.4, sy, sx - 0.6, sy - 2.6], "#cfae68");
    P(ctx, [sx - 5.2, sy - 8, sx - 2.6, sy - 10.4, sx + 0.4, sy - 6.6, sx - 5.6, sy - 4.6], "#fdf4d4");
    ctx.fillStyle = "#fffbe8";
    ctx.fillRect(sx - 5, sy - 1.4, 2, 1.4); ctx.fillRect(sx + 1.6, sy - 1.4, 2, 1.4);
    P(ctx, [sx + 3.2, sy - 10.6, sx + 8.6, sy - 10.2, sx + 8.4, sy - 5, sx + 3, sy - 5.4], "#fdf2ce");
    P(ctx, [sx + 8.6, sy - 10.2, sx + 8.4, sy - 5, sx + 5.6, sy - 5.2], "#cfae68");
    P(ctx, [sx + 8.4, sy - 8, sx + 11.4, sy - 7.2, sx + 8.4, sy - 5.6], "#e8d09c");
    ctx.fillStyle = "#8a6a2c"; ctx.fillRect(sx + 10.8, sy - 7.4, 1, 0.9);
    P(ctx, [sx + 3.4, sy - 10.6, sx + 4, sy - 14.6, sx + 5.6, sy - 10.4], "#e8d09c");
    P(ctx, [sx + 6.2, sy - 10.4, sx + 7.6, sy - 14.2, sx + 8.4, sy - 10.2], "#e8d09c");
    P(ctx, [sx + 3.8, sy - 11, sx + 4.2, sy - 13.4, sx + 5, sy - 11], "#fffbe4");
    ctx.fillStyle = "rgba(255,240,180,0.4)";
    ctx.beginPath(); ctx.arc(sx + 6.4, sy - 8.2, 2.4, 0, Math.PI * 2); ctx.fill();
    EY(ctx, sx + 6.4, sy - 8.2, 1.2, "#fff8d0", "#7a5a1c");
    P(ctx, [sx - 7.4, sy - 1.2, sx - 13.4, sy - 6.6 + Math.sin(t / 260) * 1.4, sx - 11.4, sy - 8.4 + Math.sin(t / 260) * 1.4, sx - 6.2, sy - 4.4], "#f6e4ac");
    ctx.fillStyle = "#fffbe4";
    ctx.fillRect(sx - 13.9, sy - 8.8 + Math.sin(t / 260) * 1.4, 2.4, 2.4);
    for (let i = 0; i < 3; i++) {
      const ph = (t / 700 + i * 0.34) % 1;
      ctx.fillStyle = `rgba(255,246,200,${0.7 * (1 - ph)})`;
      ctx.fillRect(sx - 6 + i * 6, sy - 12 - ph * 10, 1.4, 1.4);
    }
}

After inserting, add stag, unicorn, lightfox to SPECIES_K (the per-species size-ratio table added in v15) with these ratios relative to player height: Stag 1.15, Unicorn 1.30, Lightfox 1.05 — matching the already-approved reference-sheet scale.

Proof gates — standard gauntlet plus:

Extend debug/run4.js with assertions matching the table above exactly (HP/dmg/cooldown/PvP-capable for all three), plus confirm Unicorn and Lightfox are correctly excluded from taming outside their time windows.
Extend debug/run5.js's coverage sweep to include all three new species.
New: a worldgen sanity check — generate a seeded world (or reuse the existing test-seed pattern already in the harnesses) and confirm at least one Enchanted Forest tile and one Sacred Meadow tile actually exist somewhere in it. If neither appears, the hash threshold is wrong — fix the threshold, don't ship an unreachable biome.

Explicitly not touched this version: mounting/riding (future version), crafting recipes for the two new resources (undesigned, future), Golden Orb / Eternal Tower content (future).

After v17 ships successfully, do not start any further version automatically — wait for NEXT_BUILD.md to be updated with the next target, exactly as before.
