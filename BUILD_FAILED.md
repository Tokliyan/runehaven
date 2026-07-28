# Build failed — v16 (pet combat & uses)

## What I attempted

Per `NEXT_BUILD.md` ("Build exactly per the 'Confirmed, locked spec for the
next build — v16' section in README.md"), I read `runehaven-art-style/SKILL.md`
in full, then reviewed the current `runehaven.html` to scope the v16 patch:
pet auto-attack combat, the Beastmaster +20% HP/dmg buff, the downed/recover
state, the stats table for currently-implemented species, and the mount
speed bonus.

## What's blocking me

The locked spec's **Mounts** paragraph says:

> the 9 bible-listed mountable species ... grant +18% movement speed while
> ridden, independent of the combat stats below. Only build this for
> species that already exist in the current file

Two of those nine (Griffin, Shadowfox) already exist in `runehaven.html`, so
this reads as in-scope for tonight. But there is **no riding/mounting
mechanic anywhere in this codebase to attach that bonus to** — I confirmed
this with targeted searches across `runehaven.html`, `debug/run2.js`
through `run5.js`, and `runehaven-art-style/SKILL.md`:

- No keybind, prompt, or UI to mount/dismount a pet (contrast with the
  existing `[E] Beastmaster Shrine`-style prompts, or the tame-window
  prompt logic).
- No "ridden"/"mounted" state field on the player or pet objects.
- No handling anywhere for what riding should do to existing pet-follow
  behavior (`updatePet`), combat (`tryAttack`), rendering (`drawSpecies`,
  `updatePet`'s follow-offset math), or collision.

"Grant +18% movement speed while ridden" only makes sense once a rider
state exists to gate it on, and the spec doesn't describe how mounting is
triggered, whether the player can still fight or use items while mounted,
how it interacts with the pet's own following/combat behavior, or how it
should render. Building that from scratch would mean inventing a
non-trivial interaction system the locked spec never actually specifies —
exactly the kind of guess the standard process tells me not to make.

## Why I didn't ship the rest of v16 anyway

The other four pieces of the spec (pet auto-attack targeting/cooldown,
Beastmaster's +20% HP/dmg buff, the downed-then-recover-at-75s state, and
the HP/Dmg/Cooldown/PvP-capable stats table for Sprites/Wolf/Golem/
Shadowfox/Boar/Bear/Griffin/Phoenix) looked buildable and unambiguous on
their own. But README.md's standard process, step 5, is explicit: if
anything fails or is ambiguous, stop and **leave `runehaven.html`
unchanged** rather than ship a partial build. So I made no edits to
`runehaven.html` at all.

One smaller thing worth flagging for whoever picks this back up (not a
blocker on its own, just a design gap the spec leaves open): the targeting
rule for Rare+ pets says they "may also assist their owner against another
player (PvP) if that player is already in combat with the owner." There's
no existing "in combat with a specific player" tracking in the codebase —
the closest analog is the blood-window (`me.lastKillAt`) and poison-DoT
timers. Whoever builds this will need to add a similar short combat-window
timestamp keyed per opponent; I'd treat that as a tunable to design (per
process rule 3), not a blocker.

## What would unblock this

Either:
1. A follow-up instruction narrowing v16 to exclude Mounts (build pet
   combat/downed/Beastmaster-buff/stats table now, defer mounts to a build
   where the riding mechanic itself is specified), or
2. A spec addendum describing how mounting/dismounting should actually
   work (trigger, combat-while-mounted rules, rendering, interaction with
   pet-follow/combat) so it isn't invented from scratch.

I did not alter `runehaven.html`, `runehaven-art-style/SKILL.md`, or
`debug/*.js`.
