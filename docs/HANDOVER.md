# HANDOVER: the baton between chats

> Updated at the END of every session (or earlier if the chat gets long).
> A brand-new chat should be able to continue from this file + PLAN.md + AI_RULES.md alone.

_Last updated: 2026-09-25 · S3 chat (mode A: AI writes, Daksh reviews)_

## Last completed step
**S3 complete ✅** (steps 1-6: reproduction, genes + mutation, aging, event bus + tribes, tribe splits, agent visuals).
23/23 tests pass (node + headless Chromium). Screenshot checked at year 10: 60 FPS, outlines make every tribe colour readable.
Daksh committed steps 1-5; **step 6 (visuals) + S3 docs still need committing** (see "Next step").

## Current state
- Repo: `C:\Users\Daksh\Documents\petri-dish-civ` (branch `main`, remote https://github.com/dakshpsingh21/petri-dish-civ). `/docs` = source of truth.
- Live: https://dakshpsingh21.github.io/petri-dish-civ/ (auto-deploys on push to `main`). Tests: `/tests.html`.
- Run locally: `python -m http.server 8000` in repo root -> http://localhost:8000. **DevTools open, Network -> "Disable cache".**
- Files: `index.html`, `style.css`, `tests.html`, `.nojekyll`, `src/{main,config,rng,noise,world,agent,genes,events,tribes,sim,render,renderAgents}.js`.
- What works (S1-S2 summary): seeded RNG, fixed-timestep loop, value-noise terrain, grain + fruit with per-cell caps, seasons, trails, overlay. See git history / ARCHITECTURE for details.
- S3 (new):
  - **Reproduction** (`agent.tryReproduce`, `sim.reproduce`): age >= `minAge` 200, both stores >= `threshold` 16, `cooldown` 600 ticks since last child -> child on a random walkable neighbour; parent's stores split in half (food is conserved). Runs after the agent loop, before `removeDead`; loops only to the pre-birth length (newborns act next tick). Pop cap `maxPopulation` 5000 (never reached; food limits first).
  - **Genes** (`genes.js`): `{greed, trust, aggression, memory}` all 0..1. `varyGenes(base, amount, rng)` = `clamp01(g + (rng()-rng())*amount)` (tent distribution). `inheritGenes` uses `mutationRate` 0.05 (flag `mutation`). Culture `{greed, trust, aggression}` offsets start at 0, child gets a COPY. `effectiveTrait = clamp01(gene + culture)`. `geneDistance` = Euclidean over 4 genes.
  - **Aging**: `maxAge` = 1200 ± 400 (always rolled, even with flag off, to keep the RNG sequence identical). Metabolism x (1 + 0.5 * age/maxAge). `diedOf` = 'starved' | 'oldAge'; `state.deaths` counts both. Founders start at a random age in the first half of life.
  - **Events + tribes**: `createBus()` (on returns unsubscribe; emit). `createSim(config, w, h, bus)`: main.js creates the bus and subscribes first, so it hears tick-0 events. 8 starting tribes with random homes; each founder joins the nearest home, genes = `varyGenes(tribe.founderGenes, 0.15)`. Tribe = `{id, name, hue (id*137.508 % 360), founderGenes, parentTribeId, population, foundedTick, extinctTick}`. `updatePopulations` recounts from scratch each tick and emits `tribe:extinct` once. Events: `tribe:founded {tick, tribeId, name, parentTribeId, parentName}`, `tribe:extinct {tick, tribeId, name}` (console only for now).
  - **Splits**: at birth, if `geneDistance(child, tribe.founderGenes) > splitThreshold` (0.35) -> child founds a new tribe (flag `tribeSplits`). Must stay > 0.3 (max founder spread).
  - **Visuals** (`renderAgents.js`): colour = tribe hue, 4 age bands (dark = old), size 60-100% by food, dark outline (red if effective aggression > `view.aggressiveEdge` 0.7). Agents grouped by fillStyle; neutral white trails; food alpha 130.
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
  Browser (overlay, normal run ~1.2-1.4k agents, DevTools open): **~14.5 ms/tick**. Fine at 20 TPS for now.
  At year 1, ~38% of agents have a neighbour (492 of 1,292; avg 0.48 neighbours each) -> meetings are fairly rare.
- Headless test pattern: `node --input-type=module -e "const b='<repo>/src/'; const {createSim,step}=await import(b+'sim.js'); ..."`. tests.html can also be run in node by extracting its module script and stubbing `document`.

## Next step
1. **Daksh:** hard-refresh, look at the tribe colours / red edges / dark elders, then commit:
   `git add .` / `git commit -m "feat(render): colour agents by tribe, size by food, shade by age"` / `git push`.
   Then a docs commit is included in the same `git add .` (PLAN, HANDOVER, ARCHITECTURE, AI_RULES updated).
2. **New chat: S4 step 1 (Society):** naive O(n^2) neighbor finding **on purpose**; record baseline ms/tick at 500 / 1k / 2k / 5k agents here. Ask mode A/B first (Daksh used A in S1-S3).

## Known bugs / open questions
- **Tribes fully mix by ~year 10** (nothing keeps tribe-mates together). Parked a "tribe cohesion" idea; check first whether S4 interactions cause clustering on their own.
- **Most deaths are starvation (~90%)**; old age ~10%. Realistic, but S5 elders need old agents: revisit lifespan (900 -> ~28% old age, pop ~1,250) if elders are too rare.
- ~90 living tribes by year 50, most tiny. History Book (S10) must filter by importance; hues start to look alike past ~20 tribes.
- `agent.js` is 156 lines (target ~150). If it grows in S4, move movement/eating into their own file.
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

## Files changed in the last session
- New: `src/genes.js`, `src/events.js`, `src/tribes.js`, `src/renderAgents.js`
- Updated: `src/agent.js` (object createAgent, lifespans, growOlder, aging metabolism, tryReproduce), `src/sim.js` (bus param, tribes, homes, reproduce, checkSplit, populations, death causes), `src/config.js` (flags reproduction/mutation/aging/tribeSplits; aging, tribes, reproduction knobs; regrowth 0.006; 1000 founders; view.aggressiveEdge), `src/render.js` (uses renderAgents, white trails, food alpha 130), `src/main.js` (bus + console listeners, overlay: births/deaths/genes/tribes/key), `tests.html` (23 tests)
- Docs: `PLAN.md` (S3 ticked, parked tribe cohesion), `HANDOVER.md`, `ARCHITECTURE.md` (file tree, agent fields), `AI_RULES.md` (genes.js/events.js in sim-code list)
