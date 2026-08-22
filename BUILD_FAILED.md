# BUILD FAILED — 2026-08-22

**Target:** `NEXT_BUILD.md` → README.md "Confirmed, locked spec for the next
build (PIN Fixes + Guilds + Admin)".

**Outcome:** STOPPED before any edit. `runehaven.html` is unchanged, no
harness was run, nothing was committed. Two of the four parts are RED under
README step 5.

---

## RED 1 — PART C (Guilds) contradicts the bible outright

The spec says guilds are "the last genuinely unbuilt bible system" and that
"the bible scopes this as identity and grouping only."

Neither is true. `RUNEHAVEN_BIBLE.md` line 160, section **TEAMING &
ALLIANCES**, says the opposite in full:

> No formal guild or clan system exists in the game. All alliances and
> teaming are organised outside of RuneHaven — Discord, group chats, in
> person. Players can fight together, share base locations, or coordinate
> raids entirely on their own terms. This keeps the in-game world raw and
> unpredictable — anyone could be an enemy or an ally.

Line 61, under **BASES**, repeats it: "All teaming is organised outside the
game — Discord, group chats, in person."

Those are the only two places the bible mentions teaming at all. It does not
under-specify guilds — it names the guild system specifically and rules it
out, and gives the design reason for ruling it out. Confirmed by grep:
`guild`, `clan` and `alliance` appear nowhere else in the bible, and
`guild`/`clan` appear zero times anywhere in `runehaven.html`, so there is no
existing partial implementation this could be read as continuing.

Building `guilds` / `guild_members` tables plus guild tags on nameplates
would therefore be inventing a lore/design element the bible explicitly
excludes. README step 3 ("Never invent bible content") and step 5's third RED
bullet both stop this, and that bullet says severity never overrides it — so
"it's only identity, no perks" does not make it shippable.

**To unblock, one of these — a human decision, not mine:**
1. Amend `RUNEHAVEN_BIBLE.md`'s TEAMING & ALLIANCES section to actually
   permit a formal guild system, then re-issue the spec; or
2. Drop PART C from the spec; or
3. Re-scope it to something the bible does support (e.g. purely local,
   client-side friend labels with no shared tables) and say so explicitly.

## RED 2 — PART D (Admin bootstrap) rests on a false premise about the file

The spec states: "the only existing path to `role === "admin"` is a
debug-only hook — no real player can ever become admin right now, which means
the world-reset safeguard's second key is currently unreachable by design."

That is not what the code does. There are two paths, not one:

- `runehaven.html:1650` — `debugSetV39({role})`, the debug-only hook the spec
  describes.
- `runehaven.html:4354` — the **real login path**. Every returning player's
  row is read as `role: p.role === "admin" ? "admin" : "player"`, straight
  off the `players` table. Its own comment (lines 4348-4353) cites the bible
  for it: *"the bible's own admin field — 'Ability to promote other players
  to admin via Supabase (role column: player → admin)'. Read only, never
  written by the game."*

So the second key is already reachable exactly the way the bible prescribes:
the owner sets `role = 'admin'` on a `players` row in Supabase, that player
logs in, `isAdmin()` (line 5015) returns true, `worldResetExecAllowed()`
(line 5016) passes. The bootstrap gap PART D was written to close does not
exist, and the bible's **ADMIN — FULL DETAILS** section (line 178) names the
`role` column as *the* promotion mechanism.

Building PART D as written would add a second, competing source of admin
truth (a new `admins` table) alongside the bible's `role` column, and add an
in-game promote/demote panel where the bible says promotion happens via
Supabase. That is a real design decision about which mechanism is canonical,
with a live safeguard (the world-reset executor) depending on the answer —
not a tunable. Under README step 5's closing rule ("when genuinely unsure
which zone something belongs in: treat it as RED"), it stops here.

**To unblock, decide and state in the spec:**
- Is `admins` meant to *replace* the `players.role` column as the source of
  truth (in which case `isAdmin()` must change, and the spec's "the
  world-reset executor keeps reading `isAdmin()` exactly as it already does,
  unchanged" needs rewriting), or to *supplement* it (in which case: which
  wins when they disagree)?
- Does the bible's "promote via Supabase" line permit an in-game panel that
  writes admin status? If yes, the bible should say so; if no, PART D is
  mostly already built.

---

## PARTS A and B — verified sound, blocked only by being in this spec

Both check out against the file and are ready to build as written the moment
the spec is re-issued. Recorded here so the next run does not re-derive them:

- **PART A** is accurate. `accountPinLookup()` (line 4170) initialises
  `mode: "none"` at line 4171 and returns early at lines 4180 and 4182 on any
  `account_pins` failure — both before line 4183, the only line that can set
  `mode` to `"create"`. A missing table does make the whole feature silently
  invisible for new and existing accounts alike, exactly as described.
- **PART B** is accurate. `requirePinForLogin()` line 4231 treats
  `mode === "none"` as "proceed, no field", and `showPinField()` (line 4191)
  only ever reveals the input for `"create"` or `"verify"`, so a pre-existing
  unprotected account currently has no route to set a PIN.

I did not build A and B on their own. The spec is one locked version, and
choosing to ship half of it would be deciding scope myself, which the routine
prompt forbids ("Never decide what to build next on your own"). If shipping
A+B alone is wanted, that is a fine call — but it needs to come from an
updated `NEXT_BUILD.md` / spec, not from me.

## What the next run should do

Nothing in this repo is broken or half-applied — this is a clean stop, not a
recovery. Once the spec is amended, delete this file and run the standard
process from the top.
