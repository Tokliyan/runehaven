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

## Confirmed, locked spec for the next build (PIN Fixes + Guilds + Admin)

Account PIN Protection shipped successfully. This addresses two real
gaps found testing it, plus the last genuinely unbuilt bible system.

**PART A — visible signal when the PIN system is inactive.** Confirmed
directly: `accountPinLookup()` initializes `mode: "none"` and returns
early on any `account_pins` query failure — before ever reaching the line
that would set `mode: "create"`. This means a missing table doesn't just
degrade gracefully, it makes the whole feature silently invisible, new
account or not. Add a real signal: if `out.system === false` is ever
returned during a lookup, show a small, dismissible one-time notice near
the username field — "PIN protection isn't active on this world yet" —
not blocking, not repeated every keystroke, just visible instead of
silent.

**PART B — retroactive PIN-setting for pre-existing unprotected
accounts.** Confirmed: `mode === "none"` currently means "existing name,
no PIN, skip the field entirely." Add a genuine path: when `mode ===
"none"`, show a smaller, optional "Protect this name with a PIN" link
rather than nothing — clicking it reveals the same create-PIN field,
submitting writes the `account_pins` row exactly like a new account does.
Never required, always available, so an account like a long-running dev
account can close this gap without needing a database edit.

**PART C — Guilds.** New tables, same house pattern as `base_pieces`:
```sql
create table guilds (
  id bigserial primary key,
  name text unique,
  leader text
);
create table guild_members (
  guild_id bigint references guilds(id),
  username text primary key
);
```
A player with no guild can create one (name + becomes leader) or request
to join an existing one by name. The leader can accept/remove members.
A guild tag renders next to a member's name wherever their username
already shows (nameplate, chat if any exists, kill feed) — reuse the
existing name-rendering call sites, don't add a second one. No guild
perks, no shared storage, no guild-only mechanics — the bible scopes this
as identity and grouping only; anything mechanical is explicitly out of
scope for this version.

**PART D — Admin tooling, including the bootstrap gap this build found.**
Confirmed: the only existing path to `role === "admin"` is a debug-only
hook — no real player can ever become admin right now, which means the
world-reset safeguard's second key is currently unreachable by design,
not by choice. Add a real bootstrap: the very first row ever inserted
into a new `admins` table (`create table admins (username text primary
key);`) can only be set directly in Supabase — document this plainly, do
not invent an in-game way to self-promote, that would defeat the whole
point of a second key. Once at least one real admin exists, they get an
in-game panel (reachable only when `isAdmin()` is true) to promote or
demote other players by username, writing to that same table. This
panel is the ONLY thing that writes to `admins` — the world-reset
executor keeps reading `isAdmin()` exactly as it already does, unchanged.

**Proof gates:** standard gauntlet plus confirm the PIN-inactive notice
shows exactly once per session, not repeatedly; confirm the retroactive
PIN link appears only for `mode === "none"` and correctly writes
`account_pins`; confirm a guild tag renders at every existing
name-display call site with no new one invented; confirm the admin panel
is completely unreachable without `isAdmin()` true; confirm promoting a
second admin through the panel actually grants them panel access too, not
just the flag.

**After this version ships successfully, do not start any further
version automatically** — wait for `NEXT_BUILD.md` to be updated.
