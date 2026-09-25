# HANDOVER: the baton between chats

> Updated at the END of every session (or earlier if the chat gets long).
> A brand-new chat should be able to continue from this file + PLAN.md + AI_RULES.md alone.

_Last updated: 2026-09-25 · S4 chat (mode A: AI writes, Daksh reviews)_

## Last completed step
**S4 steps 1-5 complete ✅, step 6 (flashes) written + tested, waiting on Daksh's visual check.**
47/47 tests pass (node; `tests.html` in the browser takes ~20-30 s).
Daksh committed through step 3 (maybe 4); **steps 4-6 + S4 docs may still need committing** (see "Next step").

## Current state
- Repo: `C:\Users\Daksh\Documents\petri-dish-civ` (branch `main`, remote https://github.com/dakshpsingh21/petri-dish-civ). `/docs` = source of truth.
- Live: https://dakshpsingh21.github.io/petri-dish-civ/ (auto-deploys on push to `main`). Tests: `/tests.html`.
- Run locally: `python -m http.server 8000` in repo root -> http://localhost:8000. **DevTools open, Network -> "Disable cache".**
- Files: `index.html`, `style.css`, `tests.html`, `.nojekyll`, `package.json` (only `"type": "module"`, no deps), `tools/bench.mjs`, `src/{main,config,rng,noise,world,agent,genes,events,tribes,sim,render,renderAgents,neighbors,society,rules,minds,fx,renderFx}.js`.
- What works (S1-S2 summary): seeded RNG, fixed-timestep loop, value-noise terrain, grain + fruit with per-cell caps, seasons, trails, overlay. See git history / ARCHITECTURE for details.
- S3 (new):
  - **Reproduction** (`agent.tryReproduce`, `sim.reproduce`): age >= `minAge` 200, both stores >= `threshold` 16, `cooldown` 600 ticks since last child -> child on a random walkable neighbour; parent's stores split in half (food is conserved). Runs after the agent loop, before `removeDead`; loops only to the pre-birth length (newborns act next tick). Pop cap `maxPopulation` 5000 (never reached; food limits first).
  - **Genes** (`genes.js`): `{greed, trust, aggression, memory}` all 0..1. `varyGenes(base, amount, rng)` = `clamp01(g + (rng()-rng())*amount)` (tent distribution). `inheritGenes` uses `mutationRate` 0.05 (flag `mutation`). Culture `{greed, trust, aggression}` offsets start at 0, child gets a COPY. `effectiveTrait = clamp01(gene + culture)`. `geneDistance` = Euclidean over 4 genes.
  - **Aging**: `maxAge` = 1200 ± 400 (always rolled, even with flag off, to keep the RNG sequence identical). Metabolism x (1 + 0.5 * age/maxAge). `diedOf` = 'starved' | 'oldAge'; `state.deaths` counts both. Founders start at a random age in the first half of life.
  - **Events + tribes**: `createBus()` (on returns unsubscribe; emit). `createSim(config, w, h, bus)`: main.js creates the bus and subscribes first, so it hears tick-0 events. 8 starting tribes with random homes; each founder joins the nearest home, genes = `varyGenes(tribe.founderGenes, 0.15)`. Tribe = `{id, name, hue (id*137.508 % 360), founderGenes, parentTribeId, population, foundedTick, extinctTick}`. `updatePopulations` recounts from scratch each tick and emits `tribe:extinct` once. Events: `tribe:founded {tick, tribeId, name, parentTribeId, parentName}`, `tribe:extinct {tick, tribeId, name}` (console only for now).
  - **Splits**: at birth, if `geneDistance(child, tribe.founderGenes) > splitThreshold` (0.35) -> child founds a new tribe (flag `tribeSplits`). Must stay > 0.3 (max founder spread).
  - **Visuals** (`renderAgents.js`): colour = tribe hue, 4 age bands (dark = old), size 60-100% by food, dark outline (red if effective aggression > `view.aggressiveEdge` 0.7). Agents grouped by fillStyle; neutral white trails; food alpha 130.
- S4 (new):
  - **Tick order now:** season+regrow -> shuffle -> per agent (age, move, eat, metabolise; death flash) -> **4. meet** -> 5. births -> 6. remove dead + populations -> tick++ -> **7. every 600 ticks: `startRelationsYear` + emit `year:end {tick, year}`**.
  - `neighbors.js`: `findNeighborsNaive(agents, agent, radius, out)`: O(n^2) on purpose, Chebyshev radius (`society.radius` 1 = 3x3), reuses `out`.
  - `society.js` `meet()`: each living agent (shuffled order) picks ONE random neighbour (rng) -> `decide` -> `apply` -> tally (world `state.interactions` + tribe relations) -> `updateReputation` -> flash. Flag `features.interactions`.
  - `rules.js`: `decide(agent, other, {reputation, config})` PURE -> 'TRADE'|'SHARE'|'STEAL'|'IGNORE' (IGNORE added vs plan: nothing scores above `minScore` 0.1). warmth = trust + 0.5 x reputation. trade = lopsidedness x (0.5+0.5 warmth) if complementary; steal = myNeed x aggression x (1-warmth) if they have more of what I need; share = (theirNeed-myNeed) x (1-greed) x warmth. Ties trade > share > steal.
    `apply(action, agent, other, rng, config, guard)`: food only MOVES; every amount capped at half the gap (share 2 / trade 3 each way / steal 3). Steal chance = 0.5+0.5(aggrA-aggrB) - `guardWeight` 0.5 x guard; ALWAYS one rng call.
  - `minds.js`: `agent.memory` Map otherId -> rep (-1..1), LRU (delete+set on touch, evict first key), capacity 2..20 from the memory gene, empty at birth. Victim/receiver remembers: trade +0.2 both, share +0.3, steal (even failed) -0.3, **betrayal** (victim liked thief, rep > 0) x3. `guard` = victim's distrust, peeked with `get()` in society.js.
  - `tribes.js` relations: `relations.thisYear` / `lastYear` = Map actorTribe -> Map targetTribe -> {trades, shares, steals, failedSteals, betrayals}. DIRECTED, same-tribe included. `topRelations()` for display; main.js `console.table`s the top 5 each `year:end`.
  - `fx.js`: ring buffer (typed arrays, `FX_CAPACITY` 256). `pushFx` samples 1-in-N with a counter (`view.fxEvery` trade 1, share 4, steal 8, death 1), NO rng; sim never reads it. `renderFx.js` draws gold trade ring, green share ring, red steal "x", faint white death ripple, fading over `view.fxLife` 30 frames; ages per frame. Flag `view.flashes`.
  - Overlay: `sim ms/tick`, `meet`, `acts` (trades/shares/steals/failed/betrayals).
  - `tests.html` sets `config.features.interactions = false` for the old long tests (naive search makes them take minutes); society/fx tests switch it on in a config copy.
- Headless results (seed 'daksh' unless noted, 1000 founders, 20-60 years):
  - Carrying capacity scales with regrowth: 0.002 -> ~310, 0.004 -> ~700, 0.006 -> ~1,200 (now 0.006).
  - **Breeding earlier = SMALLER population**: minAge 0 -> ~1,060 (median age 90); minAge 200 -> ~1,210 (median 149). Cooldown 0 -> ~1,160, 0% old-age deaths; cooldown 600 -> ~1,400, ~10% old-age deaths, median age 325. Doomed babies waste food.
  - Neutral **genetic drift**: with no selection, gene averages wander differently per seed (trust 0.51 -> 0.61 on 'daksh', -> 0.39 on 'petri'). Baseline for S4+ (a shift that is consistent across seeds = selection).
  - Tribes, no splits: no extinctions in 20 years; sizes diverge by geography/luck ('petri': Mardorzen 265 -> 458, Thitodor 71 -> 9).
  - Splits at 0.35: first ~year 5-7, then ~10-15/year; self-limiting (mean distance from own founder holds ~0.19 for 60 years); ~90 tribes alive at year 50 but only ~15 with 20+ members.
  - ~0.55-0.7 ms/tick at ~1,200-1,400 agents.
- **S4 baseline: naive O(n^2) neighbour search** (`tools/bench.mjs`, seed 'daksh', radius 1, births/aging/metabolism off so n stays fixed; 20 warm-up + 100 timed ticks):

  | agents | Windows node: OFF | ON | neighbour cost | Linux VM node: cost |
  |---|---|---|---|---|
  | 500 | 0.38 | 1.10 | 0.72 ms | ~0.8-1.0 ms |
  | 1,000 | 0.41 | 3.68 | 3.27 ms | ~3.7 ms |
  | 2,000 | 0.63 | 12.65 | 12.02 ms | ~17 ms |
  | 5,000 | 1.19 | 109.99 | **108.8 ms** | ~136 ms |

  2x agents -> ~4x cost (n^2). At 5k the search alone is ~14x the 8 ms sim budget -> S12 target.
  After steps 2-6 the "ON" column also includes decide/apply/memory/tallies: Linux VM 5k = ~178 ms (was ~138). S12 should time the search and the interaction logic separately.
  Browser (overlay, normal run ~1.2-1.4k agents, DevTools open): **~14.5 ms/tick**. Fine at 20 TPS for now.
  At year 1, ~38% of agents have a neighbour (492 of 1,292; avg 0.48 neighbours each) -> meetings are fairly rare.
- **S4 decide() dry run** (reputation 0, nothing applied): TRADE ~2%, SHARE ~12%, STEAL ~20-27%, IGNORE ~60%. Trade is rare because neighbours live on the same terrain -> same hunger -> not complementary (trade only at plains/forest borders).
- **S4 step 3 A/B (interactions off vs on, 10 years, NO memory/reputation yet):**

  | seed | pop yr10 off -> on | old-age deaths | aggression | trust | greed |
  |---|---|---|---|---|---|
  | daksh | 1,397 -> 1,510 | 1,272 -> 1,796 | 0.49 -> **0.70** | 0.48 -> **0.31** | 0.37 -> 0.49 |
  | petri | 1,244 -> 1,394 | 1,141 -> 1,566 | 0.45 -> **0.72** | 0.59 -> **0.39** | 0.47 -> 0.29 |

  Population +8-12% (moving food around smooths starvation). **Aggression rises and trust falls on BOTH seeds = real selection, not drift** (greed goes opposite ways = drift). Thieves win because stealing has no consequence yet: ~390k successful steals vs ~25k trades + ~84k shares per 10 years. Step 4 (memory + betrayal penalty) is the test: does reputation push aggression back down?
- **S4 step 4: memory + reputation + guard (10 years, interactions on):**

  | setup | daksh aggr | petri aggr | successful steals (daksh) |
  |---|---|---|---|
  | no memory (step 3) | 0.70 | 0.72 | ~399k |
  | memory + betrayal, reputation only affects the ACTOR's choice | 0.68 | 0.75 | ~405k |
  | + guard 0.5 (known thief -> lower steal chance) **(kept)** | 0.69 | 0.74 | ~298k |
  | + guard 1.0 | 0.72 | 0.74 | ~242k |
  | scratch test: guard 0.5, victim aggression NOT a defence | 0.72 | 0.75 | ~474k |

  Memory works (year 3: 46% of neighbour pairs know each other; 345 negative vs 106 positive opinions), and guard cuts theft 25-40%, but **aggression still wins**. Not an arms race (the scratch test rules out "aggression pays as a defence"). Best explanation: **hit and run**. 54% of meetings are with strangers (newborns, travellers, forgotten ones), so a thief never runs out of fresh victims. Game theory: cooperation needs repeated meetings or reputation that travels ahead of you -> **S5 gossip is the real test** (hypothesis for S13: gossip ON -> average aggression lower after 10 years, on 5+ seeds).
- Year-3 relations (daksh): the busiest pairs are SAME-tribe (Uranur -> Uranur: 2,824 steals). Tribes start as regions, so neighbours are mostly kin -> most theft is internal. History Book material.
- Headless test pattern: `node --input-type=module -e "const b='<repo>/src/'; const {createSim,step}=await import(b+'sim.js'); ..."`. tests.html can also be run in node by extracting its module script and stubbing `document`.

## Next step
1. **Daksh:** hard-refresh (DevTools open, cache disabled). Check: gold/green rings + red sparks + white death ripples; overlay `acts` line; console table of tribe relations at each year end. `/tests.html` -> 47 PASS. If flashes look right, tick S4 step 6 in PLAN.md. Then commit (suggested, one per step if not yet done):
   - `feat(minds): LRU memory, reputation, betrayal penalty, victims guard against known thieves`
   - `feat(tribes): directed per-year tribe relation tallies + year:end event`
   - `feat(fx): sampled ring-buffer flashes for trade, share, steal and death`
   - `docs: S4 handover, findings, architecture file tree`
2. **New chat: S5 step 1 (Minds):** tribe opinions in `minds.js`; `decide()` falls back on the actor's opinion of the other's TRIBE for strangers. Ask mode A/B first (Daksh used A in S1-S4).
   S5's big question from S4: **does gossip stop aggression taking over?** (see S4 findings). Measure aggression at year 10 on 'daksh' + 'petri' after gossip, same `ab.mjs`-style run as in S4.

## Known bugs / open questions
- **Tribes fully mix by ~year 10** (nothing keeps tribe-mates together). Parked a "tribe cohesion" idea; check first whether S4 interactions cause clustering on their own.
- **Most deaths are starvation (~90%)**; old age ~10%. Realistic, but S5 elders need old agents: revisit lifespan (900 -> ~28% old age, pop ~1,250) if elders are too rare.
- ~90 living tribes by year 50, most tiny. History Book (S10) must filter by importance; hues start to look alike past ~20 tribes.
- `agent.js` is 157 lines, `sim.js` 174, `render.js` 152 (target ~150, flag at 200). Next growth in sim.js -> move `reproduce`/`checkSplit` into their own file.
- **Aggression takes over** (~0.70 by year 10 on both seeds) even with memory + guard: "hit and run" on strangers (54% of meetings). S5 gossip is the planned fix; if it isn't enough, options: a failed theft costs the thief food (a fight), or guard also from tribe opinion.
- **Trade is rare** (~2% of decisions, ~25k per 10 years vs ~300k steals): neighbours share terrain -> same needs. Trade happens at plains/forest borders. May need a nudge before S11's gold trade-network lines look interesting.
- Flashes age per FRAME (like trails): shorter on 144Hz. Render-only, accepted.
- `tests.html` long tests run with interactions OFF (speed). Once S12's spatial hash lands, switch them back on.
- Trails fade per FRAME (faster on 144Hz); 8-bit alpha leaves a faint ghost. Render-only, accepted.
- GitHub auth: Git Credential Manager browser login (or fine-grained PAT, never pasted in chat).
- **AI must never run git from its shell, not even `git status`/`git log`** (it left a stale `.git/index.lock` again in S3; fix: `del .git\index.lock`).
- `config.seed` is hard-coded; URL seeds come in S8.
- 5k @ 60fps target includes all mechanics; document per-flag cost if one is too expensive.
- Exact metric for "trade network formed": define before S13.

## Decisions made (and why)
| Decision | Why |
|---|---|
| Vanilla JS ES modules + Canvas, no build step | Hard constraint; shows real fundamentals |
| Sim code never touches the DOM (`sim.js` vs `main.js`/`render.js`) | Enables headless experiments + keeps runs deterministic |
| Seeded RNG (mulberry32) from S1; never `Math.random()` in the sim | Reproducibility from day one; nothing to hunt down later |
| Fixed-timestep sim, separate render | Same results on any screen/machine; speed knob changes pace, not outcome |
| Event bus for rare facts (push) + yearly stats (pull) | 5k agents would flood a bus with per-interaction events |
| Agents as plain objects first; typed arrays only if profiling says so | Readability first; measure before optimizing |
| Agent memory = `Map` used as an LRU cache | Built-in insertion order makes "forget the oldest" trivial |
| World grids = flat typed arrays (terrain, grain, fruit, caps, region) | Compact + fast; index = y * width + x |
| Terrain from seeded value noise, seasons as a triangle wave | Pure arithmetic → deterministic across browsers (no `Math.sin`) |
| Two resources (grain + fruit) | Makes trade truly useful instead of a flat bonus |
| Behavior = genes + culture + experience (clamped) | Nature / nurture / life: three speeds of change; strong interview story |
| Tribe opinions + gossip on top of per-agent memory | Turns single betrayals into tribal grudges ("never traded again") |
| Command queue for all UI/god edits, applied at tick start | No half-updated state; one door for changes; enables replay later |
| Feature flag + knobs per mechanic | Debugging, per-flag perf cost, free A/B experiments for Findings |
| fx buffer is write-only from sim, never uses RNG | Visuals can't change history |
| Staggered minds + tribe updates | Keeps 5k agents affordable with all mechanics on |
| Charts hand-drawn on canvas | No dependency; good learning + talking point |
| Integer zoom + imageSmoothingEnabled=false; world size independent of screen size | Crisp cells; same sim on any monitor |
| Agents shuffled every tick (seeded Fisher-Yates); dead removed by one-pass compaction | Removes first-mover bias; O(n) cleanup keeps order stable (determinism) |
| `.nojekyll` in repo root | GitHub Pages serves files as-is, skips the Jekyll build |
| AI never runs git; Daksh runs all git commands | AI shell cannot delete files -> stale index.lock |
| Regrowth = fraction of each cell's OWN cap per tick | A flat amount let poor cells produce as fast as fertile ones (cap only limited storage); headless test showed zero deaths |
| Two resources via terrain lookup tables (GRAIN_CAP / FRUIT_CAP) | Simple, readable; forces travel between plains and forest |
| Movement by hunger-weighted score | One formula handles "seek what you lack" and random wander when full |
| Seasons = triangle wave, yearly average exactly 1 | Deterministic (no Math.sin); moves food in time without changing the total |
| `twoResources` OFF burns double grain | Same total need -> fair A/B comparison later |
| `config.view` for render-only settings (trails) | View settings must never change the sim; no RNG in render |
| Terrain painted once to a cached layer | Static -> cache it; food/trails change -> redraw |
| Repo `/docs` is the source of truth; a mirror lives in the Claude project | New chats load the baton cheaply; the repo shows the process to reviewers |
| Child's food comes out of the parent's stores (split in half) | Conservation: fresh food per birth would create energy from nothing |
| Reproduction needs minAge 200 + cooldown 600 | Fewer doomed babies -> bigger, older population; old age becomes a real cause of death |
| Regrowth 0.002 -> 0.006 | With births, regrowth sets carrying capacity (~1,200-1,400 agents) |
| All genes in 0..1 (`memory` instead of `memorySize`) | One mutate rule for every gene; S4 maps `memory` to a real size |
| `genes.js` as its own file (pure functions) | Keeps agent.js small; easy to unit-test |
| Mutation = `(rng()-rng()) * rate` | Tent distribution: small changes common, big ones rare |
| Culture copied with `{...}` | Parent and child must not share one object |
| `createAgent({...})` takes one object | 9 positional args are easy to mix up |
| Lifespan always rolled, even with aging off | Same RNG sequence with flag on/off -> fair A/B |
| Founders start at a random age | Avoids an artificial mass die-off when all founders hit maxAge together |
| Bus passed INTO createSim | Listeners subscribe before tick-0 events fire; tests can count events |
| Tribe populations recounted from scratch each tick | Can never drift out of sync (vs incremental +1/-1) |
| Starting tribes = nearest of 8 random homes; founders vary around tribe genes | Tribes start as regions and differ genetically (needed for splits) |
| Split = distance from tribe's FOUNDER genes, checked only at birth | Parent-child distance is at most 0.1, so it would never split; founder is a fixed anchor; genes never change after birth |
| Agents drawn grouped by fillStyle; outline on every agent | fillStyle changes are slow; outlines keep hues readable on grass and fields |
| `renderAgents.js` split out of render.js | render.js would pass ~190 lines |
| Naive O(n^2) neighbour search kept on purpose (`neighbors.js`) + `tools/bench.mjs` | Honest "before" number for S12's spatial hash |
| Chebyshev radius 1 for "neighbour" | Same 3x3 square agents move in |
| `decide()` pure, reputation passed in via context; `IGNORE` as a 4th outcome | Testable with hand-made agents; well-fed strangers shouldn't be forced to act |
| Each trait has ONE job (trust -> cooperate, aggression -> steal, greed -> don't share) | Behaviour stays explainable |
| All transfers capped at half the gap; food only moves | Conservation; giver never poorer than receiver; victim never robbed to 0 |
| Steal always makes exactly one rng call | RNG sequence independent of outcomes |
| `meet()` in `society.js`, memory in `minds.js` (per ARCHITECTURE) | sim.js was 182 lines; minds.js grows in S5 |
| LRU = `Map` delete+set on touch, evict `keys().next()` | Built-in insertion order does the bookkeeping |
| Target remembers (victim / receiver / both for trade); failed thefts count | "What was done to me" is what shapes future choices |
| Guard: known thieves have lower steal chance (`guardWeight` 0.5), guard passed into `apply()` | Without it a bad reputation cost thieves nothing; rules.js stays memory-agnostic |
| Tribe relations DIRECTED, nested Maps, rolled at year end, `year:end` event | "A robbed B" != "B robbed A"; no string keys per interaction |
| fx = typed-array ring buffer, counter sampling, flag in `config.view` | Visuals can't change history (test proves it); no garbage |
| `package.json` with only `"type": "module"` | Silences Node's module-type warning (a stray package.json in C:\Users\Daksh confused it) |

## Files changed in the last session
- New: `src/neighbors.js`, `src/rules.js`, `src/society.js`, `src/minds.js`, `src/fx.js`, `src/renderFx.js`, `tools/bench.mjs`, `package.json`
- Updated: `src/sim.js` (meet phase, contacts/interactions/fx state, death flashes, year roll + `year:end`), `src/agent.js` (memory Map), `src/tribes.js` (relations tallies), `src/config.js` (flag interactions; `society` knobs; `view.flashes/fxLife/fxEvery`; `FX_CAPACITY`), `src/render.js` (draws fx), `src/main.js` (ms/tick meter, meet/acts lines, year-end relations table), `tests.html` (47 tests)
- Docs: `PLAN.md` (S4 steps 1-5 ticked), `HANDOVER.md`, `ARCHITECTURE.md` (file tree), `AI_RULES.md` (sim-code list)
