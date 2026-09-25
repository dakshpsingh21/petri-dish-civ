# Petri Dish Civilization: Architecture

> How it's built. Read the section you need, not the whole file.
> Numbers below are starting guesses. The real values live in `src/config.js`.

---

## 1. Big picture

```
                 ┌─────────────────────────── browser tab ────────────────────────────┐
 URL ?seed&p ───►│ main.js  (requestAnimationFrame + fixed-timestep loop)              │
                 │    │ step() × N per frame                     render() × 1          │
                 │    ▼                                              ▼                 │
                 │ ┌────────── SIM (pure JS, no DOM) ──────────┐  ┌───── VIEW ──────┐  │
                 │ │ commands.js ◄──── queued god actions ─────┼──┤ ui/controls.js  │  │
                 │ │    ▼ applied at start of each tick        │  │ ui/setup.js     │  │
                 │ │ sim.js ─► world.js noise.js  agent.js     │  │ ui/inspector.js │  │
                 │ │           rules.js  minds.js  tribes.js   │  │ ui/camera.js    │  │
                 │ │           nature.js spatialHash.js rng.js │  │ render.js       │  │
                 │ │           stats.js                        │  │ ui/charts.js    │  │
                 │ │ fx.js (flash buffer, write-only) ─────────┼─►│ ui/historyBook  │  │
                 │ │ events.js (bus) ── emit ──────────────────┼─►│   .js           │  │
                 │ │    └─► chronicle.js ─► templates.js ──────┼─►│                 │  │
                 │ └───────────────────────────────────────────┘  └─────────────────┘  │
                 └────────────────────────────────────────────────────────────────────┘
```

**Rule #1:** everything in the SIM box is plain JavaScript that never touches `document`,
`window` or the canvas. That gives us three things:
1. We can run it **headless** at max speed for experiments (S13).
2. Drawing can never change the outcome, which keeps runs deterministic.
3. Each module can be tested alone in the console.

**Rule #2:** the UI **never** changes sim state directly. It queues **commands**, and
the sim applies them at the start of the next tick (§5.2).

## 2. Folder structure

```
petri-dish-civ/
├── index.html  style.css  README.md
├── docs/                 # PRD, ARCHITECTURE, PLAN, HANDOVER, AI_RULES, (FINDINGS)
├── tests.html            # tiny no-dependency test page (console.assert)
├── package.json          # only "type": "module" for Node (no dependencies)
├── tools/bench.mjs       # headless ms/tick benchmark (S4 baseline, S12 before/after)
├── experiments.html      # headless experiment runner (S13)
├── assets/               # demo.gif
└── src/
    ├── main.js           # boot + loop; the only file that wires sim ↔ view
    ├── config.js         # defaults, knobs, feature flags, presets
    ├── rng.js            # seeded RNG (mulberry32) + string→seed hash
    ├── noise.js          # seeded 2D value noise for terrain
    ├── events.js         # tiny event bus (on / off / emit)
    ├── commands.js       # god-action queue: UI pushes, sim applies
    ├── sim.js            # step(state): one tick in a fixed phase order
    ├── world.js          # terrain, grain/fruit grids, regrowth, seasons, regions
    ├── agent.js          # create, move, eat, metabolism, aging, reproduce
    ├── genes.js          # genes + culture: random, vary/mutate, inherit, distance, effective trait
    ├── neighbors.js      # naive O(n^2) "who is near me?" (S4 baseline; replaced by spatialHash in S12)
    ├── society.js        # the meetings phase: pick neighbour -> decide -> apply -> tallies -> memory -> fx
    ├── rules.js          # decide TRADE / SHARE / STEAL / IGNORE (pure) + apply outcome
    ├── minds.js          # memory, tribe opinions, gossip, learned trust, culture, defection
    ├── tribes.js         # registry, names/hues, relations, centroids, moods/raids
    ├── nature.js         # drought, harvest, plague, nature mode
    ├── spatialHash.js    # fast "who is near me?" lookup (S12)
    ├── stats.js          # yearly snapshots for charts + chronicle
    ├── fx.js             # ring buffer of visual flashes (sim writes, render reads)
    ├── chronicle.js      # detects notable events → structured entries
    ├── templates.js      # entries → sentences
    ├── render.js         # draws the layers (§9) under the camera transform
    ├── renderAgents.js   # agent layer: tribe colour, size = food, dark = old, edges (grouped by colour)
    ├── renderFx.js       # draws + ages fx flashes (rings, sparks, ripples)
    └── ui/
        ├── controls.js   # grouped knobs, flags, layer toggles, disaster buttons
        ├── setup.js      # New World screen + presets + share link
        ├── camera.js     # zoom, pan, follow, screen ↔ world, picking
        ├── inspector.js  # view/edit a selected agent or tribe
        ├── charts.js     # hand-drawn canvas charts
        └── historyBook.js# the History Book panel
```

## 3. Data model

### World (`world.js`)
Flat typed arrays, one value per cell. Cell (x, y) lives at index `i = y * width + x`.
```js
world = {
  width: 200, height: 150,
  terrain:  new Uint8Array(n),    // 0 water, 1 plains, 2 forest, 3 hills, 4 mountain
  grain:    new Float32Array(n),  // current grain
  fruit:    new Float32Array(n),  // current fruit
  grainCap: new Float32Array(n),  // max grain here (from terrain + moisture)
  fruitCap: new Float32Array(n),
  region:   new Uint8Array(n),    // named-region id for the History Book
};
```
- **Terrain** comes from two noise maps: *elevation* → water / lowland / hills / mountain,
  *moisture* → dry (grain) vs wet (fruit). Water + mountain can't be crossed.
- **Regrowth** = a fraction of the cell's own cap per tick (`grain += grainCap * rate * seasonFactor`), so fertile cells produce more, not just store more.
- **Seasons:** `seasonFactor(yearFraction, peak, strength)` is a **triangle wave** (plain arithmetic, no `Math.sin`) that averages exactly 1 over a year.
  Grain peaks mid-summer, fruit mid-autumn, so trade demand changes with the seasons. `state.season = {year, name, grainFactor, fruitFactor}`.

*Why typed arrays:* 30,000 cell objects would be slow and heavy. Flat arrays are compact and fast.

### Agent (`agent.js`): nature, nurture, life
```js
{
  id: 1042, parentId: 991, tribeId: 3, alive: true,
  x: 17, y: 88,              // integer cell coordinates
  age: 310, maxAge: 900,     // ticks; lifespan = base ± seeded random
  lastBirth: 250, diedOf: null,  // birth cooldown; 'starved' | 'oldAge' once dead
  grain: 20, fruit: 18,      // two stores; either hits 0 → death. "energy" = grain + fruit
  genes:      { greed, trust, aggression, memory },  // all 0..1; inherited + mutated, fixed for life (memory -> size in S4)
  culture:    { greed, trust, aggression },  // offsets; copied from parent, pulled by elders
  experience: { trust },                     // offset from own life; NOT inherited
  memory:        new Map(),  // otherAgentId -> reputation (-1..+1), LRU capped at memorySize
  tribeOpinions: new Map(),  // tribeId -> opinion (-1..+1), fed by interactions + gossip
  infected: 0,               // plague ticks remaining
}
// effective trait = clamp01(genes.t + culture.t + experience.t)   ← what behavior uses
```
**Three layers** is the interview story. *Genes* change slowly (only across generations).
*Culture* spreads sideways between living agents. *Experience* is personal and dies with
the agent. Charts show genes vs effective traits, so you can watch culture outrun evolution.

**Memory = LRU cache with `Map`:** `delete(id)` then `set(id, rep)` moves an entry to the
"newest" end. When `size > memorySize`, delete the first key (the oldest).

`decide()` checks what the agent knows, in order: **personal reputation** → **tribe opinion** → **effective trust**.

### Tribe (`tribes.js`)
```js
{
  id: 3, name: "Varu", hue: 212, parentTribeId: 1,
  foundedTick: 2040, extinctTick: null,
  founderGenes: {...},        // drift from these → split
  population: 57,
  centroid: { x, y },         // updated every K ticks
  avgTraits: {...},           // for defection checks + charts
  mood: "calm",               // "calm" | "raiding"
  raidTarget: null,           // tribeId
}
relations: Map<"3|7", { trades, shares, steals, betrayals, lastTradeTick, yearsAllied }>
// key always uses the smaller id first so "3|7" and "7|3" are the same pair
```

### Sim state (`sim.js`)
```js
state = { tick, seed, rng, config, world, agents: [], tribes: Map, relations: Map,
          commandQueue: [], fx, nature: { drought, harvest, plague }, nextAgentId, nextTribeId }
```
Reset = build a new one. Checksum = hash it.

## 4. The simulation loop

### Fixed timestep (`main.js`)
```js
let acc = 0, last = performance.now();
function frame(now) {
  acc += Math.min(now - last, 250);   // clamp: a background tab won't explode on return
  last = now;
  const stepMs = 1000 / config.ticksPerSecond;   // speed knob
  let steps = 0;
  while (acc >= stepMs && steps < MAX_STEPS_PER_FRAME) { step(state); acc -= stepMs; steps++; }
  render(state, camera);
  requestAnimationFrame(frame);
}
```
*Why:* ticks are the same size on any screen or machine, so the same seed gives the same
history. The speed knob changes the *pace*, not the *outcome*. `MAX_STEPS_PER_FRAME` stops
the "spiral of death" (slow frame → more ticks → slower frame → ...).

### One tick (`sim.js`), always in this order
0. **Apply queued commands** (god edits, knob changes, disaster buttons)
1. `world.regrow()`: cap-limited, × season × drought/harvest multipliers
2. `nature.tick()`: timers, random events (nature mode), plague spread
3. Shuffle agent order with the seeded RNG (otherwise agent #0 always eats first)
4. Per agent: age, move (seek the resource you lack; avoid impassable terrain; raiders lean toward their target), eat, metabolism (rises with age), die (starvation / old age / plague)
5. Interactions: pick one adjacent neighbor → `rules.decide()` → `rules.apply()` → `minds.update()` (memory, opinions, experience) → relation tallies → `fx.push()`
6. Minds, **staggered** (only agents where `index % N === tick % N`): gossip, elder culture pull, defection
7. Reproduction (pop cap) + mutation + culture copy + split check
8. Remove dead (one-pass compaction), update populations, emit extinctions
9. Every K ticks: tribe centroids, average traits, moods / raid targets
10. Every `TICKS_PER_YEAR`: `stats.sample()` → emit `year:end`

## 5. How modules talk

### 5.1 Event bus (`events.js`) + yearly pull
```js
const listeners = new Map();                     // type -> Set of functions
export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
}
export function off(type, fn) { listeners.get(type)?.delete(fn); }
export function emit(type, payload) { listeners.get(type)?.forEach(fn => fn(payload)); }
```
| Channel | Used for | Why |
|---|---|---|
| **Push** (`emit`) | Rare facts: `tribe:founded`, `tribe:extinct`, `tribe:defection`, `raid:start/end`, `disaster:start/end`, `year:end`, `sim:reset` | Cheap because they're rare |
| **Pull** (read `stats` / `relations` on `year:end`) | Frequent things: births, deaths, trades, steals, gossip | 5k agents would flood the bus. Count, then read the totals yearly |

The sim emits *facts* (ids, numbers), never sentences.

### 5.2 Command queue (`commands.js`)
```js
queue({ type: "setAgentGenes", id: 1042, genes: { trust: 0.05 } });
queue({ type: "setTribeRelation", a: 3, b: 7, opinion: -1 });  // force a feud
queue({ type: "startDrought", years: 5 });
// sim.js step 0: apply every queued command in order, then clear the queue
```
*Why:* edits never land halfway through a tick (no half-updated state). Every change to the
world goes through one door, so it's easy to debug. And a list of `{tick, command}` = a
**replay log** (parked idea: put it in the share link).

### 5.3 FX buffer (`fx.js`)
The sim calls `fx.push(type, x, y)` into a fixed-size ring buffer (oldest gets overwritten).
Render reads it and draws fading sparks. Sampling is **deterministic** (e.g. every k-th
steal), and fx **never** calls the RNG, so turning flashes on or off can't change history.

## 6. Feature flags + knobs (`config.js`)
```js
features: { terrain, seasons, twoResources, aging, gossip, learnedTrust,
            culture, defection, raids, natureMode, plague }
```
Every mechanic checks its flag, and every mechanic's numbers are knobs. *Why:*
- **Debugging:** switch things off until the bug disappears.
- **Performance:** measure the cost of each flag (S12).
- **Findings:** flags = free A/B experiments ("gossip on vs off") (S13).
- **UI:** flags + knobs show up in controls (live) and in the setup screen (at start).

## 7. The History Book pipeline
```
 sim ──emit──► chronicle.js ──detectors──► entry {year, type, tribes[], region, data, importance}
                   ▲                               │
   stats + relations + opinions (year:end)         ▼
                                      templates.js → "Year 212: The Varu betrayed the Oskel..."
                                                   ▼
                                      ui/historyBook.js  +  map highlight
```
- **Event types:** founded, extinction, boom, famine, drought / plague / harvest, war (raid), defection wave, betrayal, long alliance, lasting grudge, plus follow-ups.
- **Causal links:** tribe T has entry A, then entry B within K years → B is written as a consequence ("Famine followed.").
- **Follow-ups:** a betrayal schedules a check 20 years later; if the two tribes still haven't traded → "...never traded again."
- **Regions:** compass sector + main terrain ("the western hills", "the lake shore"). Location = the region at the tribe's centroid.
- **Noise control:** importance score, rate limit, merge near-duplicates.
- **Variety:** several templates per type, picked with the seeded RNG.

## 8. Determinism
- `rng.js` = **mulberry32** (about 5 lines, 32-bit state). A string seed (`?seed=riverwar`) is hashed to 32 bits.
- Sim code never calls `Math.random()`, `Date.now()` or `performance.now()`.
- One RNG stream, used in a fixed phase order (§4).
- Avoid `Math.sin/exp/log` in the sim: engines can differ in the last bits. Noise and seasons are pure arithmetic.
- `fx` and all rendering never touch the RNG.
- **Guarantee:** same seed + same setup + same command log → identical history. The checksum test is in `tests.html`.

## 9. Rendering (`render.js`) + camera

Layers, bottom → top (each one can be toggled in the UI):

| Layer | How | Cost |
|---|---|---|
| Terrain | drawn once to an offscreen canvas; redrawn only if terrain changes | ~free |
| Resources | ImageData, 1 px per cell (grain = yellow, fruit = green), scaled up | low |
| Territory tint | dominant tribe per cell from hash buckets, every K ticks (S12) | medium |
| Trails | offscreen canvas faded a little each frame, agents stamp their hue | low |
| Network lines | lines between tribe centroids: gold = trade, red = feud, width = volume | low (few tribes) |
| Agents | color = tribe, size = energy, brightness = age, red edge = aggression; batched by tribe | medium |
| FX | fading sparks / pulses / ripples from `fx` | low (capped) |
| Labels + selection | tribe names at centroids; highlight around the selected agent/tribe | low |

**Camera (`ui/camera.js`):** `{ scale, offsetX, offsetY, followTribeId }`, applied with
`ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY)`.
Picking: `worldX = (screenX - offsetX) / scale`. Zoom keeps the point under the cursor fixed.

## 10. What can be edited, and where

| Where | Start of run (`ui/setup.js`) | During run (`controls` / `inspector`) |
|---|---|---|
| World | seed, size, water level, mountains, moisture | regrowth, season strength, drought / harvest / plague buttons |
| Population | start pop, # tribes, trait ranges per tribe | pop cap, mutation rate, lifespan, spawn agents at a spot |
| Minds | which flags start on | trust bias, memory length, gossip / learning / culture rates, flags on/off |
| One agent | n/a | genes, culture, experience, stores, memory entries, tribe opinions |
| One tribe | name (via preset) | rename, shift members' traits, force alliance / feud, start/stop raid |
| View | n/a | speed, pause/step, layer toggles, zoom/pan/follow |

Everything in the right column goes through the command queue.

## 11. Performance strategy (target: 5,000 agents @ 60fps, all flags on)
Frame budget is 16.6 ms → **sim ≤ 8 ms**, render ≤ 4 ms, UI + slack for the rest.
1. **Measure first.** FPS + ms/tick overlay from S1. Baseline in S4 (naive neighbors) → before/after in S12.
2. **Fix the Big-O:** naive neighbor search is O(n²) (25M checks at 5k). A **spatial hash** makes it about O(n).
3. **Spatial hash:** one bucket per cell, rebuilt each tick with a **counting sort** into `Int32Array`s (`cellStart`, `cellAgents`). No allocations. Also feeds the territory tint.
4. **Stagger:** minds run on 1/N of agents per tick; tribe centroids/moods every K ticks. Same result in the long run, a fraction of the cost.
5. **No garbage in hot loops:** reuse arrays; no `{}` or closures per agent per tick.
6. **Compaction**, not `splice`, to remove the dead.
7. **Cheap rendering:** cached terrain, ImageData, batching by color, capped fx, UI ~4×/sec.
8. **Escape hatches (parked, ask first):** typed-array agents, Web Worker, WebGL.

## 12. Testing (zero dependencies)
`tests.html` runs `console.assert` checks: RNG repeatability, same-seed noise maps,
`rules.decide` obvious cases, LRU eviction, trait clamping, and the determinism checksum
(seed + command log). Plus a manual check after every step: run it, look, confirm.
