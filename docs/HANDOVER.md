# HANDOVER: the baton between chats

> Updated at the END of every session (or earlier if the chat gets long).
> A brand-new chat should be able to continue from this file + PLAN.md + AI_RULES.md alone.

_Last updated: 2026-09-25 · S1 + S2 chat (mode A: AI writes, Daksh reviews)_

## Last completed step
**S2 complete ✅** (steps 1-5: noise, terrain, grain + fruit, seasons, trails). All verified in headless Chromium by the AI (9/9 tests pass, screenshot OK).
Daksh still needs to eyeball steps 4-5 in his browser and commit (see "Next step").

## Current state
- Repo: `C:\Users\Daksh\Documents\petri-dish-civ` (branch `main`, remote https://github.com/dakshpsingh21/petri-dish-civ). `/docs` = source of truth.
- Live: https://dakshpsingh21.github.io/petri-dish-civ/ (auto-deploys on push to `main`, 1-2 min). Tests: `/tests.html`.
- Run locally: `python -m http.server 8000` in repo root -> http://localhost:8000. **Keep DevTools open with Network -> "Disable cache"** (ES modules get cached; stale modules = missing-export errors / old sim).
- Files: `index.html`, `style.css`, `tests.html`, `.nojekyll`, `src/{main,config,rng,noise,world,agent,sim,render}.js`.
- What works:
  - S1: seeded RNG (mulberry32, FNV-1a string hash, Fisher-Yates shuffle), fixed-timestep loop (20 TPS, clamp 250 ms, max 10 steps/frame), overlay (FPS/TPS/tick/year+season/growth factors/alive/seed; box auto-sizes).
  - `noise.js`: hashed-lattice value noise + smoothstep + 4 octaves; `noiseMap()` -> Float32Array. No Math.sin.
  - `world.js`: elevation + moisture maps (seeds drawn from main RNG, stretched to 0..1) -> terrain Uint8Array WATER/PLAINS/FOREST/HILLS/MOUNTAIN; PASSABLE + GRAIN_CAP/FRUIT_CAP lookup tables; grain/fruit + caps; regrowth = **fraction of the cell's own cap** per tick; seasons (yearFraction, seasonName, triangle-wave seasonFactor, yearly average exactly 1).
  - `agent.js`: agents carry grain + fruit (die if either hits 0); move to the neighbour with best `grain*grainHunger + fruit*fruitHunger` (seeded reservoir-sampling tie-break); eat both; metabolize (flag off = double grain burn for fair A/B).
  - `sim.js`: createSim (spawn only on passable land, 1000-try cap) + step: updateSeason -> regrow -> shuffle -> agents (age, move, eat, metabolize) -> removeDead (compaction). `state.season = {year, name, grainFactor, fruitFactor}`.
  - `render.js`: layers = cached terrain (painted once, elevation-shaded) -> food (gold/green mix, alpha = amount) -> trails (destination-out fade per frame, render-only) -> coral agents -> overlay.
  - `config.js`: `features {terrain, twoResources, seasons}`, `terrain {...}`, `view {trails, trailFade}`, `ticksPerYear: 600`, `seasons {strength 0.8, grainPeak .375, fruitPeak .625}`, grain/fruitRegrowth 0.002, startStore 10, maxStore 20, biteSize 2, metabolism 0.25 (each). **Seed is 'daksh'** (Daksh changed it).
- Headless results (seed "daksh", 2000 start agents, no reproduction yet):
  - Two resources: settles ~340; **survivors near plains/forest borders 44% vs 30% of land** (emergent ecotone clustering; "petri": 48% vs 28%).
  - Seasons ON 272 vs OFF 337: same yearly food, 20% fewer survivors -> population is limited by the WORST season (step-wise deaths each lean season).
  - Grain-only flag: 403. ~0.4-0.75 ms/tick at 2k agents.
- Headless test pattern: `node --input-type=module -e "const b='<repo>/src/'; const {createSim,step}=await import(b+'sim.js'); ..."`.

## Next step
1. **Daksh (before new chat):** hard-refresh, check seasons in overlay + trails, then
   `git add .` / `git commit -m "feat(world): add seasons and fading trails"` / `git push`.
2. **New chat: S3 step 1 (Life & lineage):** reproduction: both stores above a threshold -> child in adjacent passable cell, parent's stores split; respect a population cap. Ask mode A/B first (Daksh used A in S1-S2).

## Known bugs / open questions
- Trails fade per FRAME (faster on 144Hz) and 8-bit alpha leaves a faint ghost below ~alpha 6. Render-only, accepted.
- Die-off is harsh (2000 -> ~270-340) and nothing refills until S3 reproduction. Expect to retune regrowth/metabolism once births exist.
- Hills look bare (cap 0.3 of each resource). Fine for now; revisit with visuals in S3/S14.
- GitHub auth: password auth fails; use Git Credential Manager browser login (or fine-grained PAT, never pasted in chat or in the remote URL).
- AI must never run git from its shell (it left a stale `.git/index.lock` once).
- `config.seed` is hard-coded; URL seeds come in S8.
- Balance risk grows with each mechanic: add one at a time behind flags, tune before the next.
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

## Files changed in the last session
- New: `src/noise.js`, `tests.html`
- Updated: `src/world.js` (terrain, grain/fruit, seasons), `src/agent.js` (two stores, hunger-weighted movement), `src/sim.js` (passable spawns, seasons), `src/render.js` (layers: terrain cache, food mix, trails, auto-size overlay), `src/config.js` (flags, terrain, seasons, view), `src/main.js` (overlay lines)
- Docs: `PLAN.md` (S2 ticked), `HANDOVER.md`, `ARCHITECTURE.md` (regrowth + seasons notes)
