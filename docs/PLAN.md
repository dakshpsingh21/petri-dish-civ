# Petri Dish Civilization: Build Plan

> One session = one chat = one milestone. Tick `[x]` when a step works and is committed.
> New ideas go to **PARKED IDEAS** at the bottom, not into the code.
> 🎤 = the interview talking point this session gives you.
> Every new mechanic gets a **feature flag + knobs** in `config.js` (see ARCHITECTURE §6), so it can be switched off, tuned, and A/B-tested in S13.

**Plan history**
- v1 (2026-09-24): 9 sessions. Seeded RNG + deploy moved into S1; History Book and experiments got their own sessions.
- v2 (2026-09-24): added terrain + seasons, two resources, aging, gossip, learned trust, culture + elders, raids, nature mode, all the visual layers, camera + inspector, a New World setup screen, and live editing of agents and tribes. **9 → 14 sessions (roughly 20–30 hours).** Presets and the share link moved to S8.

---

## S1: "It's alive" 🌱
**Goal:** blank page → dots that wander toward food, eat, starve and die. Deterministic from the first line.
- [x] 1. Skeleton: repo folder + `git init`, `index.html`, `style.css`, `src/main.js`. Serve locally (`python -m http.server 8000`) and see a colored canvas. *(ES modules don't load from `file://`.)*
- [x] 2. `config.js` + `rng.js` (mulberry32) + fixed-timestep loop in `main.js` with an FPS / tick counter overlay.
- [x] 3. `world.js` (one food `Float32Array` for now + regrowth) + `render.js` (food layer via ImageData).
- [x] 4. `agent.js` + `sim.js`: spawn N agents; each tick move toward the best neighboring food (seeded tie-break), eat, pay metabolism, die at 0. Draw agents.
- [x] 5. Push to GitHub + enable GitHub Pages → first live link.

**Files:** `index.html`, `style.css`, `src/main.js`, `config.js`, `rng.js`, `world.js`, `agent.js`, `sim.js`, `render.js` (all small)
**Done when:** agents chase food and die when it runs out · same seed → identical run · live on GitHub Pages.
🎤 *Why a fixed timestep? Why not `Math.random()`?*

## S2: A world with shape 🗺️
**Goal:** terrain, two resources and seasons, so geography starts deciding where life does well.
- [x] 1. `noise.js`: seeded 2D **value noise** + octaves (smoothstep interpolation, no `Math.sin`). Start `tests.html`: same seed → same map.
- [x] 2. Terrain from elevation: water / plains / forest / hills / mountain. Water + mountain can't be crossed. Terrain gets drawn once to a cached canvas.
- [x] 3. Two resources: **grain** (dry lowlands) and **fruit** (wet forest), with per-cell caps from terrain. Agents carry both, head for the one they lack most, and die if either hits 0.
- [x] 4. Seasons: a triangle-wave regrowth multiplier per resource with a phase offset (grain peaks in summer, fruit in autumn). Show the season in the overlay.
- [x] 5. Fading **trails** layer (render only, doesn't affect the sim).

**Files:** `noise.js`, `world.js`, `agent.js`, `sim.js`, `render.js`, `config.js`, `tests.html`
**Done when:** the map looks like a landscape · agents gather in fertile zones and migrate with the seasons · same seed → same map.
🎤 *How does value noise work? Why avoid `Math.sin` in a deterministic sim?*

## S3: Life & lineage 🧬
**Goal:** generations turn over, traits evolve, tribes form and split.
- [ ] 1. Reproduction: both stores above a threshold → child in an adjacent cell, parent's stores split; respect the population cap.
- [ ] 2. Genes + inheritance + mutation (`(rng() - rng()) * mutationRate`, clamped). Children also copy the parent's culture (it does nothing until S5).
- [ ] 3. **Aging:** metabolism rises with age; lifespan = base ± a seeded random amount; old age is a cause of death.
- [ ] 4. `events.js` (bus) + `tribes.js` (seeded syllable names, golden-angle hues); emit `tribe:founded` / `tribe:extinct`.
- [ ] 5. Tribe split: a child that drifts beyond `splitThreshold` from the founder's genes starts a new tribe.
- [ ] 6. Agent visuals: color = tribe, size = energy, brightness = age, red edge = high aggression.

**Files:** `agent.js`, `sim.js`, `events.js`, `tribes.js`, `render.js`, `config.js`
**Done when:** population rises and falls · generations turn over · colored tribes appear and split.
🎤 *Emergence vs scripting? What's an event bus for?*

## S4: Society 🤝
**Goal:** neighbors share, trade or steal, and remember who did what.
- [ ] 1. Naive neighbor finding (O(n²), **on purpose**). Record a baseline ms/tick at 500 / 1k / 2k / 5k agents in HANDOVER.
- [ ] 2. `rules.js`: `decide(agent, other, context)` → `'SHARE' | 'TRADE' | 'STEAL'` as a **pure function**, using need (trade when I lack what you have), effective traits and reputation. Add `console.assert` tests.
- [ ] 3. Apply outcomes: share = give some surplus; trade = swap surplus for need (**both** end up better off); steal = take from their bigger store (success depends on aggression).
- [ ] 4. Memory: `Map` used as an LRU capped at `memorySize`. Reputation updates after every interaction; betrayal (stealing from someone who trusted you) = big penalty.
- [ ] 5. Tribe relation tallies (trades / shares / steals / betrayals per tribe pair per year).
- [ ] 6. `fx.js` + **event flashes**: steal spark, trade pulse, death ripple. Sampled, capped, never uses the RNG.

**Files:** `rules.js`, `agent.js`, `sim.js`, `tribes.js`, `fx.js`, `render.js`, `tests.html`
**Done when:** you can *see* trades and steals · different trait mixes lead to visibly different outcomes · baseline timings recorded.
🎤 *Why is `decide()` a pure function? How does a `Map` act as an LRU cache?*

## S5: Minds that spread 🧠
**Goal:** opinions, lessons and culture spread between agents → grudges and traditions emerge.
- [ ] 1. `minds.js` + **tribe opinions**: each interaction nudges the target's opinion of the actor's *tribe*; `decide()` falls back on it for strangers.
- [ ] 2. **Gossip:** tribe-mates who meet blend their tribe opinions (rate knob), so one betrayal becomes a tribal grudge.
- [ ] 3. **Learned trust:** an experience layer (betrayed → trust ↓, good trades → trust ↑). Children don't inherit it.
- [ ] 4. **Culture + elders:** old, well-fed agents pull nearby tribe-mates' culture toward their own effective traits. Staggered: only 1/N of agents each tick.
- [ ] 5. **Defection:** an agent whose culture fits a neighboring tribe better, and who likes that tribe more, switches to it (`tribe:defection`).

**Files:** `minds.js`, `rules.js`, `agent.js`, `sim.js`, `config.js`
**Done when:** a single betrayal visibly turns into a lasting tribe-vs-tribe feud · culture drifts faster than genes.
🎤 *Genes vs culture vs experience: three layers of behavior.*

## S6: God's control panel 🎛️
**Goal:** every mechanic can be tuned and toggled live, and the charts show what's happening.
- [ ] 1. `ui/controls.js`: knobs grouped in collapsible sections (World, Life, Minds, Society, Chaos, Speed) + pause / step / reset.
- [ ] 2. `commands.js`: the UI **never** changes state directly. It queues commands that get applied at the start of the next tick. Add feature-flag toggles + view-layer toggles.
- [ ] 3. `stats.js`: yearly snapshot (population per tribe, average genes vs effective traits, food totals) in a ring buffer.
- [ ] 4. `ui/charts.js`: hand-drawn line chart (average traits over time).
- [ ] 5. Stacked-area chart of population per tribe (top N tribes + "others").

**Files:** `ui/controls.js`, `commands.js`, `stats.js`, `ui/charts.js`, `index.html`, `style.css`, `main.js`
**Done when:** every knob/flag from S1–S5 is on screen and works live · charts update ~4×/sec · no dependency added.
🎤 *Why a command queue instead of editing state directly?*

## S7: Camera + the hand of god 🔍
**Goal:** zoom in, pick any agent or tribe, and rewrite its mind mid-run.
- [ ] 1. `ui/camera.js`: zoom (wheel, around the cursor), pan (drag), `ctx.setTransform`; screen ↔ world helpers.
- [ ] 2. Picking: click → nearest agent / its tribe; selection highlight; **follow tribe** mode.
- [ ] 3. `ui/inspector.js`, agent tab: view + edit genes, culture, experience, stores, memory (per-agent reputation) and tribe opinions. All edits go through commands.
- [ ] 4. Tribe tab: rename; shift all members' traits; set its relation with another tribe (force an alliance or a feud); spawn agents at a clicked spot.

**Files:** `ui/camera.js`, `ui/inspector.js`, `render.js`, `commands.js`, `index.html`, `style.css`
**Done when:** you can zoom to one agent, make it paranoid, force a feud between two tribes, and watch what follows.
🎤 *How do you convert a mouse click into a world cell under zoom + pan?*

## S8: Worlds on demand 🌍
**Goal:** design a world before it starts, and share it with a link.
- [ ] 1. `ui/setup.js` **New World** screen: seed, map size, terrain sliders (water level, mountains, moisture), starting population, number of starting tribes.
- [ ] 2. Per-tribe starting trait ranges + which feature flags start on.
- [ ] 3. Presets as plain config objects: *Peaceful Valley*, *Harsh Desert*, *Warring Islands*.
- [ ] 4. Share link: seed + setup encoded in the URL + a "Copy link" button.

**Files:** `ui/setup.js`, `config.js`, `main.js`, `index.html`, `style.css`
**Done when:** a copied link opens the exact same starting world in another browser.
🎤 *How did you fit a whole world setup into a URL?*

## S9: Chaos: disasters, nature & war 🌪️
**Goal:** history keeps moving, whether the user clicks or not.
- [ ] 1. `nature.js`: drought + bumper-harvest buttons (timed regrowth multipliers).
- [ ] 2. Plague: infection spreads by contact, drains stores, burns out.
- [ ] 3. **Nature mode:** seeded random droughts / harvests / plagues each year (frequency knob).
- [ ] 4. **Raids:** tribe mood. Hungry + aggressive + a richer neighbor → raiding. Raiders move toward the target's centroid and steal more; emits `raid:start` / `raid:end`. Add a "Start/stop raid" button to the tribe inspector.
- [ ] 5. Tune: raids and plagues shouldn't wipe out everything; expose the thresholds as knobs.

**Files:** `nature.js`, `tribes.js`, `agent.js`, `sim.js`, `ui/controls.js`, `ui/inspector.js`
**Done when:** with nature mode on and no clicks, a 5-minute run has at least one war, one famine and one recovery.
🎤 *How do you keep random events random but reproducible?*

## S10: Chronicle engine 📜
**Goal:** the sim notices what happened, as structured data (no prose yet).
- [ ] 1. `chronicle.js`: listens to push events + runs detectors on `year:end` → entries `{year, type, tribes, region, data, importance}` (`console.table`).
- [ ] 2. Detectors: founded, extinction, famine, boom, drought / plague / harvest.
- [ ] 3. Detectors: war (raid), defection wave, betrayal, long alliance, lasting grudge (from tribe opinions).
- [ ] 4. Named regions from compass + terrain ("the western hills", "the lake shore").

**Files:** `chronicle.js`, `world.js`, `config.js`
**Done when:** the entry table matches what you saw on screen.
🎤 *Push vs pull: why not emit an event for every trade?*

## S11: The History Book ⭐📖
**Goal:** the sim writes history worth screenshotting, and it ties back to the map.
- [ ] 1. `templates.js`: several templates per event type with slots (year, tribe names, region, season); seeded choice.
- [ ] 2. Causal links ("Famine followed.") + scheduled follow-ups ("...never traded again.").
- [ ] 3. `ui/historyBook.js`: scrolling book panel, year headings, tribe names in their colors.
- [ ] 4. Noise control: importance scores, rate limit, merge near-duplicates.
- [ ] 5. Map tie-ins: **tribe name labels**, **trade/feud network lines** (gold = trade, red = feud, thickness = volume), click an entry → highlight that tribe and region.

**Files:** `templates.js`, `chronicle.js`, `ui/historyBook.js`, `render.js`, `index.html`, `style.css`
**Done when:** a 5-minute run gives 10–30 readable entries · same seed + same commands → same book, word for word.
🎤 *How did you make generated text feel like a story, with no AI?*

## S12: Performance 🚀
**Goal:** 5,000 agents at 60fps with everything on.
- [ ] 1. Profile at 5k in DevTools with all flags on. Write down the top 3 costs.
- [ ] 2. `spatialHash.js` (counting sort into `Int32Array`s) replaces the naive neighbor search. Record before/after.
- [ ] 3. Stagger the heavy work (minds every N ticks, tribe centroids/moods every K ticks) + remove per-tick allocations.
- [ ] 4. **Territory tint** layer, built from the hash buckets every K ticks.
- [ ] 5. Determinism checksum in `tests.html`: same seed + same command log → same hash after 5,000 ticks.

**Files:** `spatialHash.js`, `sim.js`, `minds.js`, `tribes.js`, `render.js`, `tests.html`
**Done when:** 5k agents at ~60fps (sim ≤ 8 ms/tick) with all flags on, or a documented cost per flag · before/after numbers recorded.
🎤 *The before/after story: "O(n²) at 5k took X ms; the spatial hash took Y ms."*

## S13: Experiments → Findings 🔬
**Goal:** real, honest, reproducible findings. Feature flags make A/B tests easy.
- [ ] 1. `experiments.html`: run headless for N ticks across seeds × settings (including flags on/off); print a table / CSV.
- [ ] 2. Write 3–4 hypotheses, each with a **precise metric** (e.g. "gossip ON → feuds last X× longer"; "trust > 0.7 → trade networks form faster").
- [ ] 3. Run each setting on ≥ 5 seeds; record the average and spread.
- [ ] 4. Draft `docs/FINDINGS.md`, including surprises and null results.

**Files:** `experiments.html`, `stats.js`, `docs/FINDINGS.md` (new)
**Done when:** 3+ findings with numbers, each reproducible from the seeds listed.
🎤 *How did you make sure the result wasn't a fluke?*

## S14: Polish & ship 🎁
**Goal:** a recruiter gets it in 30 seconds.
- [ ] 1. Visual polish + first run: open straight into a good preset in nature mode, knob tooltips, a one-line "what am I looking at?".
- [ ] 2. README: GIF at top, live link, what/why, how it works, the technical highlight, findings, how to run locally.
- [ ] 3. Record the GIF (free: ScreenToGif on Windows, or ffmpeg). Keep it under ~5 MB.
- [ ] 4. Final deploy, test in a second browser, add the link to the resume.

**Files:** `README.md`, `style.css`, `index.html`, `assets/demo.gif`
**Done when:** all 4 resume goals in PRD §7 are ticked.

---

## PARKED IDEAS 🅿️
*(Add with a date. Pick up only after S14, or if Daksh explicitly swaps one into a session.)*
- Terrain painting brush (raise mountains, dig lakes mid-run)
- Replay: put the command log in the share link so edits replay exactly (easy thanks to the command queue)
- Tribe family-tree view
- Export the History Book as an image / text
- Legendary individuals (named elders who show up in the book)
- Full struct-of-arrays agents (typed arrays) if objects become the bottleneck
- Run the sim in a Web Worker
- WebGL rendering for 20k+ agents
- Save / load snapshots
- Sound (ambient hum that follows population)
