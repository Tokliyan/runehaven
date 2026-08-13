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

## Confirmed, locked spec for the next build (v24 — intro card + real music)

v23 shipped successfully, plus a same-day hotfix (favicon removed, credits
updated, Skeptik/Advay added to Collaborations) already verified and live
on main. This section is the next locked target.

**Audio files already pushed to the repo, confirmed present:**
`audio/nu_metal.mp3`, `audio/Pop.mp3`, `audio/Slower_Jamz.mp3`,
`audio/Long_Way_Home.mp3`, `audio/seduced.mp3`, `audio/song.mp3` — all
compressed from the original FLAC uploads to 128kbps MP3, ~2-5MB each.
**These are separate files, referenced by relative URL, NOT embedded as
base64 in runehaven.html** — deliberate architecture change, confirmed
necessary: 140MB raw / 21MB compressed is far too large to inline the way
the logo images were. This is the one part of the project that is no
longer strictly "a single HTML file" — it's the HTML plus an `audio/`
folder, deployed together.

**Track roles — proposed, not confirmed, flag clearly if wrong:**
`nu_metal.mp3` → combat/boss track. `Pop.mp3`, `Slower_Jamz.mp3`,
`Long_Way_Home.mp3`, `song.mp3` → background rotation (four tracks,
cycling). `seduced.mp3` → held out, NOT wired into either rotation this
version — genuinely unclear what it's for, better to leave it unused than
guess wrong and have to unwind it later.

**PART A — the intro card. Pure typography, no image assets needed.**

A full-screen overlay shown once per page load, before the login screen
becomes visible (same "cover sits on top, login is already loaded
underneath" pattern already agreed on). Exact copy:
"Hashbrown Studios in collaboration with STG Records presents RuneHaven"
— reasonable to split across 2-3 lines for readability, do not shorten or
paraphrase the line itself.

Animation: fade+scale in (~0.6-0.8s, starts slightly smaller and fully
transparent, grows to full size while becoming opaque), hold fully visible
(~1-1.5s), fade+scale out (~0.6-0.8s, mirrors the entrance) with the login
screen beginning to crossfade in during the fade-out, not after it. Use an
eased timing function, not linear. Confirmed requirements from earlier
discussion: plays every time by default (no localStorage skip-forever),
but any keypress or click during the animation skips straight to the login
screen — do not let a click during fade-in "double-trigger" or skip past
login itself.

**PART B — background music: a real rotation, not a single loop.**

`AudioEngine.playMusic(url, loop)` currently only supports one track
looping forever — for a 4-track rotation, add a thin playlist layer on
top, do not modify `playMusic`/`playSFX`/the gain-node setup themselves,
they're confirmed working as-is:

```js
const BG_PLAYLIST = ["audio/Pop.mp3", "audio/Slower_Jamz.mp3",
  "audio/Long_Way_Home.mp3", "audio/song.mp3"];
let bgIndex = 0, inCombatMusic = false;

async function playNextBgTrack() {
  if (inCombatMusic) return;   // combat owns the music channel right now
  const url = BG_PLAYLIST[bgIndex % BG_PLAYLIST.length];
  bgIndex++;
  await AudioEngine.playMusic(url, false);   // false: don't loop this one track forever
  if (AudioEngine.musicSource) {
    AudioEngine.musicSource.onended = () => { if (!inCombatMusic) playNextBgTrack(); };
  }
}
```

Call `playNextBgTrack()` once, right after `AudioEngine.init()` succeeds
(the same ENTER-button user gesture that already creates the AudioContext
— confirmed this is the only place `init()` is allowed to be called from).

**PART C — combat music: two existing signals, one new lightweight
timestamp, no new detection system.**

Confirmed directly in the live code: `lastAttack` already updates the
instant the player attacks anything (search `lastAttack = now;`), and
`me.hp -= dmg` / `me.hp -= tick` already fire the instant the player takes
damage. Both are real "the player is in a fight right now" signals —
reuse both, don't build a third detection mechanism.

```js
let combatMusicUntil = 0;
const COMBAT_MUSIC_LINGER = 6000;   // ms after the last hit before reverting
```

At every site that sets `lastAttack = now;` AND at both `me.hp -= dmg;`
and `me.hp -= tick;` sites, add: `combatMusicUntil = performance.now() + COMBAT_MUSIC_LINGER;`

In the main game loop (wherever it already runs every frame), add a check,
throttled to roughly once a second, not every frame:

```js
const nowT = performance.now();
if (nowT < combatMusicUntil && !inCombatMusic) {
  inCombatMusic = true;
  AudioEngine.playMusic("audio/nu_metal.mp3", true);   // true: this one DOES loop, it's a single track
} else if (nowT >= combatMusicUntil && inCombatMusic) {
  inCombatMusic = false;
  playNextBgTrack();   // resumes the rotation from wherever bgIndex is
}
```

**PART D — proof gates, standard gauntlet plus:**
- Confirm all 6 audio files fetch successfully from their relative paths
  (mock `fetch` in the harness, confirm the correct URLs get requested,
  same pattern already used to mock other browser APIs in run3/run4).
- Confirm the background rotation actually advances `bgIndex` on a
  simulated `onended` firing, and wraps back to 0 after the 4th track.
- Confirm a simulated `lastAttack` update or `me.hp` decrease sets
  `combatMusicUntil` correctly, and that the loop-check correctly flips
  `inCombatMusic` both directions across the 6-second linger window.
- Confirm `seduced.mp3` is NOT referenced anywhere in the wiring — it was
  deliberately held out this version.
- Confirm the intro overlay is skippable via keypress and via click, and
  that skipping doesn't also trigger the login form underneath.

**Explicitly not touched this version:** Crystal Golem, Krakenling,
Salamander King (still queued right after this — v25 now). SFX for
individual game events (hits, taming, UI clicks) — `AudioEngine.playSFX()`
exists and works, but no actual sound-effect files have been provided yet,
same "don't wire imagined triggers to files that don't exist" rule from
v23 applies here too.

**After v24 ships successfully, do not start any further version
automatically** — wait for `NEXT_BUILD.md` to be updated with the next
target.
