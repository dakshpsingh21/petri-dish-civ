# HANDOVER: the baton between chats

> Updated at the END of every session (or earlier if the chat gets long).
> A brand-new chat should be able to continue from this file + PLAN.md + AI_RULES.md alone.

_Last updated: 2026-09-24 · planning chat (plan v2)_

## Last completed step
Nothing built yet. Planning only: the 5 docs in `/docs` were written, then expanded to plan v2
(terrain, seasons, 2 resources, aging, gossip, learned trust, culture, raids, nature mode,
visual layers, camera, inspector/editing, New World setup). 14 sessions.

## Current state
- **Nothing built yet. Next: S1 step 1.**
- How to run: n/a yet. From S1 on: run `python -m http.server 8000` in the repo root and open http://localhost:8000
- Live link: n/a yet (planned for S1 step 5)

## Next step
**S1 step 1:** create the repo folder, `git init`, copy `/docs` in, and add `index.html` + `style.css` +
`src/main.js` that show a colored full-size canvas, served via a local server.
First, ask Daksh which mode he wants: (A) You write, I review, or (B) I write, you guide (default B).

## Known bugs / open questions
- **Waiting on Daksh's go-ahead to start S1** (plan v2 reviewed in chat).
- Repo location on Daksh's computer + GitHub repo name: decide in S1 step 1.
- All balance numbers are guesses; tune them during S1–S5.
- Balance risk: many interacting mechanics. Add them one at a time behind feature flags and tune each before the next.
- The 5k @ 60fps target now includes all mechanics. If one flag is too expensive, document its cost rather than cut it silently.
- Exact metric for "trade network formed": define it before S13.

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
| Repo `/docs` is the source of truth; a mirror lives in the Claude project | New chats load the baton cheaply; the repo shows the process to reviewers |

## Files changed in the last session
- `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/HANDOVER.md`, `docs/AI_RULES.md` (created, then updated for plan v2)
