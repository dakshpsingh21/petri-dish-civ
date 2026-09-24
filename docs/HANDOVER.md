# HANDOVER: the baton between chats

> Updated at the END of every session (or earlier if the chat gets long).
> A brand-new chat should be able to continue from this file + PLAN.md + AI_RULES.md alone.

_Last updated: 2026-09-24 · S1 chat (mode A: AI writes, Daksh reviews)_

## Last completed step
**S1 complete ✅** (step 5: pushed to GitHub, Pages enabled). Session S1 closed.

## Current state
- Repo: `C:\Users\Daksh\Documents\petri-dish-civ` (branch `main`, remote `origin` = https://github.com/dakshpsingh21/petri-dish-civ). Docs in `/docs` are the source of truth.
- Works: full-window canvas, seeded RNG (mulberry32 + FNV-1a string hash + Fisher-Yates shuffle), fixed-timestep loop (20 TPS, clamp 250 ms, max 10 steps/frame), 200x150 food grid (Float32Array, linear regrowth) drawn via offscreen canvas + ImageData, 2,000 agents that move to the best of 9 cells (seeded reservoir-sampling tie-break), eat, burn energy, die. Overlay: FPS / TPS / tick / alive / seed.
- Behavior with seed "petri": die-off 2000 -> 888 between ticks 250-500, then stable (no reproduction yet). Deterministic (verified headless in Node). ~0.2 ms/tick at 2k agents.
- Shuffle check (headless, 1000 ticks): with shuffle mean survivor id 998 (fair); without shuffle mean id 804 (63% from first-created half) -> order bias is real but invisible on screen.
- How to run: `python -m http.server 8000` in repo root -> http://localhost:8000
- Headless test pattern: `node --input-type=module -e "import('./src/sim.js')..."` (sim.js has no DOM, so Node can run it).
- Live link: https://dakshpsingh21.github.io/petri-dish-civ/ (Pages deploys from `main` / root automatically on every push; takes 1-2 min).

## Next step
**Start S2 in a NEW chat.** S2 step 1: `noise.js` (seeded 2D value noise + octaves, smoothstep, no Math.sin) + start `tests.html`. Ask mode A/B first.

## Known bugs / open questions
- GitHub auth: password auth fails; use Git Credential Manager browser login (or a fine-grained PAT, never pasted in chat or in the remote URL).
- A stale `.git/index.lock` was created when the AI ran `git status` from its shell. Daksh deletes it with `Remove-Item .git\index.lock` if git complains. Rule added to AI_RULES: AI never runs git.
- Population never grows (no reproduction until S3), so after the die-off the screen is calm. Expected.
- `config.seed` is hard-coded ('petri'); URL seeds come in S8.
- All balance numbers are guesses; tune during S1-S5. Balance risk: add mechanics one at a time behind feature flags.
- The 5k @ 60fps target includes all mechanics; if one flag is too expensive, document its cost.
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
| Repo `/docs` is the source of truth; a mirror lives in the Claude project | New chats load the baton cheaply; the repo shows the process to reviewers |

## Files changed in the last session
- New: `index.html`, `style.css`, `.nojekyll`, `src/main.js`, `src/config.js`, `src/rng.js`, `src/world.js`, `src/render.js`, `src/agent.js`, `src/sim.js`
- Updated: `docs/PLAN.md` (S1 steps 1-4 ticked), `docs/AI_RULES.md` (no-git rule), `docs/HANDOVER.md`
