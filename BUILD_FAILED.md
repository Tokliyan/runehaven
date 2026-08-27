# BUILD FAILED — v47 (Balance, Anti-Exploit & Economy)

**Date:** 2026-08-27
**Result:** STOPPED before any edit. `runehaven.html` is byte-for-byte unchanged.
**Reason:** RED condition — **PART C names a creature that does not exist in the file.**

---

## THE BLOCKER — PART C's "Adult Golem"

PART C says, verbatim:

> Confirmed live: Sea Serpent `hp:130`, Adult Golem (check live value at build
> time, not assumed). Increase Sea Serpent to `hp:165`, Adult Golem by a
> comparable ~25%.

I checked the live value at build time, exactly as instructed. **There is no
Adult Golem.** It is not in `MOBS`, not in `WILD_SPECIES`, not under any other
name.

The complete `MOBS` roster as it stands today (line 2148 onward) is twelve
entries, and this is all of them:

```
elder_drake  goblin  bandit  troll  boar  bear
griffin  phoenix  dark_wraith  sea_serpent  salamander_king  golem_elder
```

Searching the entire 13,801-line file for `Adult Golem` / `adult_golem` /
`adultGolem` returns **exactly one hit, and it is a comment**:

```
2224:     Loot is runic_stone only, straight off the bible's own Adult Golem line
```

That line is inside the `golem_elder` entry, citing the bible for a loot
choice. It is a reference to the bible, not an implementation.

### The four golem-named things that DO exist, and why none of them is it

| # | Where | What it is | Why it isn't Adult Golem |
|---|---|---|---|
| 1 | `WILD_SPECIES.golem` (L2277) — `base: 0.50, count: 3, biomes: [B.RUINB]` | The **young** golem: a passive, hold-E tameable wild | The bible's own line is *"Found young in ruins only, **adults are hostile enemies**"* — this is explicitly the young one. It is not hostile and has no `hp`/`dmg` to raise. |
| 2 | `WILD_SPECIES.crystal_golem` (L2384) — `base: 0.25` | Passive wild, mountain-ruin gated | A different bible species entirely, and also passive. |
| 3 | `MOBS.golem_elder` (L2229) — `hp: 420, dmg: 20` | The Elder-tier singleton | Elder tier, not "Adult". PART A of this same spec sets Elders aside as untouchable, so PART C is unlikely to mean this one — and raising a 12-hour-respawn singleton is not "ordinary" difficulty tuning. |
| 4 | `PET_COMBAT.golem` (L2516) — `hp: 60, dmg: 5` | The **tamed pet's** combat stats | This is the player's own companion. PART C is about *"the tougher overworld/underwater mobs"* — buffing the player's pet is the opposite of that. |

### Why this is RED and not a judgment call

Measured against README step 5's own list:

- **The instruction is literally uncomputable.** "Increase by a comparable
  ~25%" needs a live value to be 25% of. There isn't one. The spec even
  anticipated uncertainty here ("check live value at build time, not assumed")
  — but it assumed the creature existed. It doesn't.
- **Building it is not a tunable, it is a whole creature.** A new `MOBS` row
  needs `hp`, `dmg`, `atkRange`, `atkCooldownMs`, `windupMs`, `aggroRadius`,
  `leashRadius`, `moveSpeed`, `count`, a `loot` table, a biome, spawn
  placement, and an art path through `drawMob`. That is far more than the
  "3+ genuinely unspecified, interdependent decisions with real gameplay
  consequences" the RED bullet describes, and every one of them would be my
  design decision, not a number the spec handed me. **PART C never asks for a
  new mob — it asks to rebalance an existing one.**
- **The spec's own proof gate cannot be satisfied.** It requires: *"confirm
  Troll/Dark Wraith are genuinely easier while Sea Serpent/**Adult Golem** are
  genuinely harder (not the same creatures moving both directions)."* There is
  no way to make a nonexistent creature genuinely harder.
- **Shipping Sea Serpent alone and quietly dropping the other half is not
  available to me.** PART C names two creatures and builds its whole rationale
  on there being two. Silently delivering half a named part is exactly the
  narrowing the standard process forbids.

Per README step 5, a RED case means: do not guess, do not fix forward, do not
ship a broken build, leave `runehaven.html` unchanged. That is what I did.

### What I need from you to unblock it

Pick one — I will not choose on my own:

1. **"Adult Golem means X."** If one of the four rows above *is* what you
   meant, say which and I will apply ~25% to it next run.
2. **"Drop Adult Golem from v47."** PART C ships as Sea Serpent `130 → 165`
   only, and the proof gate drops with it. One sentence and v47 is unblocked.
3. **"Build Adult Golem first."** Then it wants its own spec with a real stat
   block — the bible gives it *"Ruins — Hard — Runic stone"* and nothing more,
   which is a biome, a difficulty word and a loot type, not numbers. That is a
   feature version, not a line in a balance pass.

---

## SECONDARY — worth settling in the same reply (NOT what stopped the build)

I resolved both of these and would have shipped them as flagged judgment
calls. Since I am stopped anyway, they are cheaper to confirm now than to
revisit next week.

### PART A says "spawn rates", but every value it quotes is the tame chance

PART A is headed *"pet spawn rates"* and says it is about *"ordinary world
density"* — but the field and values it quotes are the **tame chance**:

- It writes the field name and value literally: `base: 0.65`. In
  `WILD_SPECIES`, `base` is documented on line 2129 as *"base: tame chance
  before modifiers"*, and it is read in exactly one place —
  `tameChanceFor()` (L1376-1386). All five Commons sit at exactly `0.65`.
- The tier bands it quotes (0.20–0.50) are `base` bands. They are not `count`
  values, which run 2/3/4/6/9.
- *"Increase each tier by roughly +0.08-0.10"* only means anything as an
  additive on a 0–1 probability. Adding 0.09 to a `count` of 9 is meaningless.

So the numbers point at `base` unambiguously while the prose points at spawn
density. **I read it as `base`** — the values are specific and the prose is
loose — which is the same call the v46 changelog's judgment call 1 made when
its spec named a `canBlock()` that didn't exist. Flagging it because if you
genuinely meant *density*, then raising tame chance is a balance change you
did not ask for, and `count` is the field you want instead.

### PART A's "confirmed live" ranges are a stale snapshot

Two of the four quoted bands do not match the file:

| Tier | PART A says | Actually live today |
|---|---|---|
| Common | `0.65` | `0.65` ✅ |
| Uncommon | `0.35-0.50` | **`0.40-0.50`** (wolf/golem 0.50, boar/stag 0.45, griffin 0.42, bear 0.40) |
| Rare | `0.20-0.30` | **`0.25-0.30`** (phoenix 0.30, all others 0.25) |
| Epic | `0.20-0.35` | **`0.20` flat** (shadowfox, lightfox, krakenling, salamander_king) |

The two that are off are off for the same reason: the **Mob Rarity + Music**
build deliberately moved Griffin `0.35 → 0.42` and Shadowfox `0.35 → 0.20`,
with written reasoning about tier bands. PART A's quoted baseline is from
*before* that build — while the same paragraph says that system *"stays
exactly as built."*

Not blocking. I would apply the `+0.08-0.10` to the **actual** live values
(Common +0.10, Uncommon/Rare +0.09, Epic +0.08 — which keeps every tier
strictly ordered: Common 0.75 > Uncommon 0.49-0.59 > Rare 0.34-0.39 > Epic
0.28), leave the three Elders and Duskfox Elder at 0.15 as instructed, and
flag it in the changelog. Say so if you want different increments.

---

## STATE OF EVERYTHING ELSE — all verified, all ready to go

I checked the rest of the spec against the file before stopping, so the next
run does not rediscover anything. **Every other anchor exists and is unique.**
Nothing below is blocked.

| Part | Anchor | Status |
|---|---|---|
| **A** | `WILD_SPECIES` (L2271-2400) | ✅ Ready — see the two notes above |
| **B** | `troll` L2159 (`hp: 90, dmg: 14`), `dark_wraith` L2182 (`hp: 65, dmg: 12`) | ✅ Both confirmed live and unique, exactly as the spec states |
| **C** | `sea_serpent` L2197 (`hp: 130`) | ✅ Sea Serpent half is ready — **Adult Golem half is the blocker** |
| **D** | `BASE_TIER_HP` L7038 — `{wood:40, stone:90, iron:180, runic:350, dragonsteel:800}` | ✅ Exactly as the spec states. 4 occurrences of the name; the *definition* is unique. `baseMaxHp()` L7052 and the damage path at L7139 are where the "roughly double the real time-to-destroy" math gets verified |
| **E** | `beforeunload` — **exactly 1 occurrence**, L6194 | ✅ Confirmed: it only calls `savePlayer()`, no warning, no friction — precisely as the spec describes. No damage-timestamp field exists yet, so the 30s window needs one new tracked value (a tunable) |
| **F** | `invAdd` L6199, `invRemove`, `GATHER_RANGE` L716, broadcast bus L5900-6029 | ✅ All present. The `item_add`/`item_del` broadcast pattern is the model to follow |
| **G** | `BASE_PIECES.foundation` L7100 (`anchor: true`), nameplate render L11937-11944 | ✅ Both present. The nameplate is the dark rounded plate + centred `11px 'Barlow'` at `sy - 28` — that is the "existing name-rendering technique" to reuse, no new component needed |
| **H** | `#login` card L450-477, `#enterBtn` L476 | ✅ Present. The optional-table fallback discipline to copy is `baseHpOf()` L7059 and the `account_pins` lookup |

### Baseline health — the file is green, the spec is what stopped us

I ran the full gauntlet on the **unmodified** file to confirm I was not
stopping on top of a pre-existing break. All three are clean and match the
v46 changelog exactly:

```
node debug/run3.js runehaven.html   →  frames pumped, CAUGHT ERROR: none
node debug/run4.js runehaven.html   →  1078 PASS / 0 FAIL
node debug/run5.js runehaven.html   →  coverage draws: 1071 — CAUGHT: none
```

(Note for the next run: the harnesses need `npm install` first — `jsdom` was
not present in a fresh clone. It is in `devDependencies` already; this cost a
couple of minutes and is not a problem, just a heads-up.)

---

## SUMMARY

One sentence blocks the whole of v47: **PART C wants a ~25% health increase on
an Adult Golem that has never been built.** Parts A, B, D, E, F, G and H are
all fully specified against a file whose anchors I have verified exist and are
unique, and the test baseline is green. Answer the three-way question in "What
I need from you to unblock it" above — and, if you like, the two PART A notes
— and v47 ships in one run.

`NEXT_BUILD.md` has not been touched, and neither has `runehaven.html`.
