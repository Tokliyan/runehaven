# RuneHaven

2D persistent open-world isometric survival RPG. Single HTML file
(`runehaven.html`) + Supabase + Netlify. Governed by `RUNEHAVEN_BIBLE.md` — full text now in this repo, read it
directly, do not assume or invent anything it doesn't state.

## Layout

```
runehaven.html              the game — currently v19 (v20 in progress)
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
5. **When something is unclear or unspecified, classify it before deciding
   what to do — RED always stops, YELLOW ships with a flagged note.**

   **RED — always STOP, no exceptions, regardless of how small it looks:**
   - Any test harness actually fails (`run3`/`run4`/`run5` catch a real
     error, or any `run4` line is `FAIL`) — this is the mechanical,
     objective signal that something is genuinely broken. Never overridden.
   - A patch anchor isn't unique.
   - The spec would require inventing bible content — a pet, mob, biome,
     location, or lore element not in the bible. This is a creative
     integrity rule, not a bug-severity one, and severity never overrides it.
   - The spec assumes an entire system exists that doesn't, AND building it
     properly needs 3+ genuinely unspecified, interdependent decisions with
     real gameplay consequences (a whole consumable-item framework, a whole
     new traversal/instance architecture — the kind of thing where any
     guess is really a design decision, not a tunable).

   For any RED case: do not guess, do not "fix forward" with invented
   content, do not ship a broken build. Write `BUILD_FAILED.md` at the repo
   root explaining exactly what's blocking and why, leave `runehaven.html`
   unchanged.

   **YELLOW — make the reasonable call, ship it, flag it clearly:**
   - A single tunable number or threshold is uncertain, but any reasonable
     value in a normal range keeps the game working (a rarity threshold, a
     cooldown, a light radius, a stat number within the established range
     for its rarity tier).
   - A minor naming or implementation choice where multiple options all
     work equally well (matching an existing code convention, e.g. an
     abbreviated enum name).
   - A visual/polish detail that doesn't affect functionality (an overlay
     offset, a minor color choice within an already-approved palette).
   - An implementation detail the spec left slightly underspecified, but
     where only one interpretation is actually sensible given everything
     else in the spec.

   For any YELLOW case: make the call, implement it, ship normally through
   the full gate above — but add a `## JUDGMENT CALLS THIS VERSION` section
   to the changelog entry in `SKILL.md` (or a top-level note in the commit
   message if it's not rendering-related) listing every one, in plain
   language, so it's easy to spot and revise the next morning. A version
   that shipped with flagged judgment calls is a complete, done version —
   not a partial one. The judgment calls are refinements to consider, not
   unfinished work.

   **When genuinely unsure which zone something belongs in: treat it as
   RED.** A missed YELLOW just means an unnecessary night lost, which is
   recoverable. A wrongly-shipped RED is a broken or invented build in a
   real player's hands, which is not.
6. On success: update `runehaven-art-style/SKILL.md` with a new dated
   changelog entry (rendering-scope changes only — mechanics/balance live in
   this README or commit messages, not the skill).
7. Extend `debug/run5.js`'s coverage lists with any new species/mobs/weapon
   kinds/classes added in this build, so future runs keep covering them.
8. **If the full gate passed cleanly** (every check above green, nothing
   flagged RED): attempt to push the final commit directly onto `main`,
   not just your own branch, as the very last step. If your environment
   does not permit a direct push to `main`, that's fine — land on the
   usual branch as before, no error, a human will sync it. This is a
   nice-to-have, never a requirement — never fail a build or treat a
   blocked push to `main` as a RED condition.

## Confirmed, locked spec for the next build (v23 — QOL: keybind remapping, settings menu, audio engine, credits, favicon)

v22 shipped successfully — 324/324 in run4, landed directly on main. This
section replaces the v22 entry as the current locked target. This version
is deliberately NOT new content — no new species, no new biomes. It's
quality-of-life and infrastructure, confirmed scoped with the person
directly: **no gamepad/controller support, ever** — keyboard only,
permanently. Everything below was checked against the live code before
being written.

**PART A — centralize every keybind through one config object, then build
a remapping UI on top of it.**

Confirmed directly: there are 11 real keybind check sites total —
`keys["shift"]` (line ~503, block-pose gate), `keys["w"/"s"/"a"/"d"]`
(movement, ~3075-3078), `keys["e"]` (interact-range check, ~3136), and
`k === "e"/" "/"i"/"c"/"p"/"f"` (single-press actions, ~3022-3033).

Introduce a single `KEYBINDS` object, e.g.:
```js
let KEYBINDS = { up:"w", down:"s", left:"a", right:"d", interact:"e",
  attack:" ", inventory:"i", craft:"c", pets:"p", dive:"f", block:"shift" };
```
Load from `localStorage` on boot if present (localStorage usage already
exists elsewhere in the file — follow the same pattern), fall back to the
defaults above if not. Replace every one of the 11 hardcoded literal
checks with a lookup against `KEYBINDS` instead (e.g. `keys[KEYBINDS.up]`
instead of `keys["w"]`). This is the entire mechanical requirement — every
other line at each site stays exactly as it is.

Build a remapping screen (reachable from the new settings menu, Part B):
list each bindable action with its current key, clicking one enters a
"press any key" capture state, the next keypress becomes the new binding,
save to `localStorage` immediately. Prevent binding two actions to the
same key — reject the attempt and show a brief inline message instead of
silently creating a conflict.

**PART B — a real settings menu, reachable from the login screen.**

Add a small gear/settings icon or link on the `#login` card (confirmed
clean insertion point — right below the tagline or near the top-right of
the card, styled consistent with the existing login UI, not a new visual
language). Opens a settings panel with these sections:

- **Graphics**: a fullscreen toggle (use the Fullscreen API,
  `requestFullscreen()` — confirmed unused anywhere in the file currently),
  and a "reduce motion / reduce particles" toggle that lowers or disables
  the more decorative particle effects already in the render code (motes,
  embers, sparkles) — this should read as one honest toggle serving both
  lower-end performance and motion sensitivity, not two separate settings.
- **Accessibility**: a text-size option (small/medium/large, applied via a
  root font-size or CSS custom property, not per-element overrides), and a
  colorblind-friendly palette toggle — propose a Deuteranopia-safe swap for
  the handful of pure red/green contrasts already in the UI (HP-red vs
  weakened-green tame ring is the clearest existing case to check first).
- **Audio**: master/music/SFX volume sliders (0-100) and a mute toggle for
  each, wired to the audio engine in Part C. No tracks exist yet — these
  controls exist and function, there's just nothing playing through them
  yet.
- **Controls**: the keybind remapping screen from Part A lives here.
- **Credits**: see Part E.

All settings persist via `localStorage`, loaded on boot, same pattern as
the keybinds.

**PART C — a real audio engine, infrastructure only, no tracks yet.**

Nothing exists currently — confirmed zero `Audio`/`AudioContext`/`<audio>`
anywhere in the file. Build using the Web Audio API (more flexible for
independent volume channels than raw `<audio>` elements):

```js
const AudioEngine = {
  ctx: null, masterGain: null, musicGain: null, sfxGain: null,
  musicSource: null,
  init() { /* create AudioContext + gain nodes on first user interaction —
             browsers block autoplay before interaction, gate this behind
             the login button click, not page load */ },
  playMusic(url, loop = true) { /* stop any current track, load and play */ },
  playSFX(url) { /* fire-and-forget, respects sfxGain */ },
  setMasterVolume(v) {}, setMusicVolume(v) {}, setSFXVolume(v) {},
  muteMaster(b) {}, muteMusic(b) {}, muteSFX(b) {},
};
```
Wire the settings-menu sliders/toggles from Part B directly to these
methods. Do NOT invent placeholder trigger points for combat/UI sounds —
there's nothing to play yet, wiring imagined trigger calls to nonexistent
files would just be dead code. This version ships the engine ready to
receive `AudioEngine.playMusic(url)` calls once real tracks exist; that
wiring is a small follow-up, not part of this version.

**PART D — favicon, ready to embed now (the one asset that's actually
final).**

Base64-encoded .ico, generated from the approved hashbrown mark (icon only,
not the "HASH BROWN" text — confirmed illegible at favicon size, cropped
tight to just the mark), pre-built and verified legible at 32px:

```html
<link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,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">
```

Insert this `<link>` tag in the `<head>`. This is the entire requirement
for this part — do not build the full logo splash/animation sequence,
that's explicitly a future version once the rest of the logo set arrives.

**PART E — credits screen, structure now, placeholder content.**

Reachable from the settings menu (Part B). Simple scrollable panel, styled
consistent with existing panels (inventory/craft/pet panel treatment).
Content is a clear placeholder for now:
```
RUNEHAVEN
Created by [Your Name] and the RuneHaven development team
Built with Claude
```
Structure the content as a simple array of `{role, name}` or plain text
lines so swapping in real names later is a one-line data change, not a
markup change.

**PART F — proof gates, standard gauntlet plus:**
- Confirm all 11 keybind sites correctly read from `KEYBINDS` and that
  rebinding a key in the settings UI actually changes real in-game
  behavior (e.g., rebind "up" to a different key, confirm movement
  responds to the new key and not "w" anymore).
- Confirm settings persist across a simulated reload (write to
  `localStorage`, re-read, values match).
- Confirm `AudioEngine` methods all exist and don't throw when called with
  no track loaded (calling `setMasterVolume` before `playMusic` should be
  safe, not assume a track is already playing).
- Confirm the favicon `<link>` renders without breaking anything in `<head>`.
- Confirm the credits panel opens and closes cleanly like other panels.

**Explicitly not touched this version:** any new species or biome (Crystal
Golem, Krakenling, Salamander King — still next after this), the full logo
splash/animation sequence, gamepad/controller support (never — confirmed
permanently out of scope), any actual music or sound-effect files, real
credits names.

**After v23 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
