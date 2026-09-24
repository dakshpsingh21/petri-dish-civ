# Petri Dish Civilization: Product Requirements (PRD)

> A browser toy where thousands of tiny agents live, trade, betray and die on a grid,
> and the simulation **writes its own history book** as it runs.

---

## 1. What it is

A single web page showing a generated landscape of plains, forests, lakes and mountains,
where **grain** and **fruit** grow with the seasons. Hundreds to thousands of agents
wander, eat, age, have children, form tribes, and meet each other. When two agents meet,
each one decides to **share**, **trade** or **steal**, based on its genes, its culture,
its life experience, and what it and its tribe think of the other.

Nothing big is scripted. Alliances, feuds, raids, defections, famines and booms
**emerge** from small rules. The user plays god: they design the world before it
starts, tune everything live, reach in to rewrite a single agent's mind or force two
tribes into a feud, trigger disasters, or switch on *nature mode* and just watch.

While it runs, the sim spots notable moments and writes them into a **History Book**:

> *Year 212: The Red tribe betrayed Blue in the eastern plains. Famine followed.
> Blue never traded with Red again.*

## 2. Why build it (motivation)

- **Emergence is fascinating.** Simple local rules produce complex global stories. It's a
  great way to show you understand systems, not just syntax.
- **Portfolio value.** It shows simulation design, performance work (5k agents at 60fps),
  determinism (seeded RNG), data viz, and product thinking (the History Book hook), all
  in plain JavaScript with no framework hiding the work.
- **Learning.** Daksh builds and owns every line and can explain every decision in an
  interview.

## 3. Target audience

| Who | What they need | What they'll do |
|---|---|---|
| **Recruiters / hiring managers** | Get it in **30 seconds** | Open the link, see something alive right away, read a few history entries, skim the README GIF + findings |
| **Engineers reviewing the code** | Clean, readable code with one strong technical detail | Read the README "How it works", open a few files, check commits |
| **Curious people** | Fun, "what if?" play | Drag sliders, trigger disasters, share a seed link with a friend |
| **Daksh** | Deep understanding + interview stories | Build it step by step, run experiments, write the findings |

## 4. Core features

| # | Feature | Summary |
|---|---|---|
**The living world**

| # | Feature | Summary |
|---|---|---|
| F1 | **Terrain** | Seeded noise map: water, plains, forest, hills, mountains. Water + mountains can't be crossed. |
| F2 | **Two resources** | Grain (dry lowlands) and fruit (wet forest). Agents need both, which makes trade valuable. |
| F3 | **Seasons** | Grain and fruit regrowth rises and falls on different cycles, so agents migrate and trade demand shifts. |
| F4 | **Agents** | Position, grain + fruit stores, age, lifespan, tribeId, genes (greed, trust, aggression, memorySize), memory (id → reputation), tribe opinions. |
| F5 | **Life cycle + aging** | Seek what you lack → eat → metabolism (rises with age) → die of starvation or old age. Reproduce when well fed. |
| F6 | **Inheritance** | Children copy genes with small mutation, plus the parent's culture. |
| F7 | **Tribes** | Lineages. Drift from the founder → a new tribe. Agents can also **defect** to a neighboring tribe that fits them better. |

**Minds and societies**

| # | Feature | Summary |
|---|---|---|
| F8 | **Interactions** | SHARE / TRADE / STEAL from needs + effective traits + reputation. Betrayal is remembered. |
| F9 | **Gossip** | Tribe-mates share opinions of other tribes, so one betrayal becomes a tribal grudge. |
| F10 | **Learned trust** | Life experience shifts trust (betrayed → wary). Not inherited. |
| F11 | **Culture + elders** | Old, successful agents pull nearby tribe-mates' behavior toward theirs, so culture spreads faster than genes. |
| F12 | **Raids** | Hungry, aggressive tribes go to war with richer neighbors as a group. |

**Playing god**

| # | Feature | Summary |
|---|---|---|
| F13 | **New World setup** | Before starting: seed, map size, terrain, starting tribes + trait ranges, which mechanics are on. Presets. |
| F14 | **Live knobs + flags** | Every mechanic has sliders and an on/off switch, grouped in panels. Pause / step / reset / speed. |
| F15 | **Inspector + editing** | Click any agent to view and edit its genes, culture, experience, stores, memory and opinions. Click a tribe to rename it, shift its traits, force an alliance or feud, start a raid, or spawn members. |
| F16 | **Disasters + nature mode** | Buttons for drought, bumper harvest and plague. Nature mode fires them randomly (seeded) so history keeps moving. |
| F17 | **Seeded runs + share link** | Seed + setup go in the URL. The same link gives the same world. |

**Seeing it**

| # | Feature | Summary |
|---|---|---|
| F18 | **Map layers** | Terrain, resources, territory tint, fading trails, trade/feud network lines, tribe name labels (each toggleable). |
| F19 | **Readable agents + flashes** | Size = energy, brightness = age, red edge = aggression. Sparks for steals, pulses for trades, ripples for deaths. |
| F20 | **Camera** | Zoom, pan, follow a tribe. |
| F21 | **Live charts** | Population per tribe; average genes vs effective traits. |
| ⭐ F22 | **The History Book** | The sim detects notable events and narrates them with templates. Click an entry to see it on the map. See §5. |

## 5. ⭐ The History Book (signature feature)

**Why it matters:** most agent sims show dots and charts. People remember *stories*.
The History Book turns raw numbers into a story someone can screenshot and share. It's the
thing that makes this project memorable instead of "another boids demo".

### Event types (first version)

| Event | Rough trigger (tuned during the build) |
|---|---|
| Tribe founded | A child drifts far enough from its tribe to start a new one |
| Extinction | A tribe's population hits 0 |
| Population boom | A tribe grows ≥ X% within a year (and is big enough to matter) |
| Famine | A tribe loses ≥ X% of its population in a year while food is scarce |
| Betrayal | Two tribes that traded regularly suddenly steal more than they trade |
| Long alliance | Two tribes trade every year for N+ years with no betrayal |
| Lasting grudge | A tribe's average opinion of another stays very negative for N+ years |
| War | A tribe starts or ends a raid on a neighbor |
| Defection wave | Many members of one tribe switch to another within a year |
| Disaster / blessing | Drought, plague or bumper harvest starts or ends (user or nature mode) |
| Follow-ups | Consequences checked later ("Famine followed", "never traded again") |

### Principles

1. **Rare and meaningful.** Only a few entries per minute of play. Spam kills the story.
2. **Tribes, not individuals.** History is about groups. Single agents are too small to care about.
3. **Cause and effect.** Link events together ("...Famine followed.") so it reads like history, not a log file.
4. **Deterministic.** Same seed + same setup + same god actions → the same book, word for word.
5. **No AI.** Templates with slots (tribe names, year, region, season), picked with the seeded RNG for variety.
6. **Tied to the map.** Regions come from real terrain ("the western hills", "the lake shore"). Clicking an entry highlights it on the map.

## 6. Non-goals (what we will NOT build)

- ❌ No backend, database, accounts, or paid anything. It's static files on GitHub Pages.
- ❌ No framework (React, etc.), no bundler, and no chart library unless Daksh approves one.
- ❌ No AI / LLM narration. Templates only.
- ❌ No multiplayer or real-time sharing (a seed link is the only kind of "sharing").
- ❌ No 3D, and no WebGL for v1 (parked in case we need it for performance).
- ❌ No detailed genetics, pathfinding or economy beyond 2 resources + 3 actions.
- ❌ No terrain painting for v1 (parked). Terrain is generated from the seed + setup sliders.
- ❌ Not mobile-first. It should *work* on a phone, but it's built for desktop.
- ❌ No save files or long-term persistence. The seed is the save.

## 7. Success criteria

### Resume must-haves
1. ✅ Live demo link on GitHub Pages
2. ✅ README with a GIF at the top
3. ✅ A "Findings" section built from real experiments, with numbers and seeds
   (e.g. *"When trust > 0.7, trade networks formed 3× faster"*)
4. ✅ One impressive technical detail explained in the README (spatial hashing for 5k
   agents at 60fps, fixed-timestep loop, seeded determinism)

### Quality bars (measurable)
- **Performance:** 5,000 agents at ~60fps on Daksh's laptop in Chrome **with all mechanics on**,
  sim ≤ ~8 ms per tick. Before/after numbers get recorded, plus the cost of each feature flag.
- **Determinism:** same seed + setup + command log, 5,000 ticks → identical state checksum on
  every run.
- **Unpredictable but explainable:** two seeds with the same settings produce clearly different
  histories, and every History Book entry can be traced back to the rules.
- **First impression:** something visibly alive within 2 seconds of opening the page.
- **History Book:** a 5-minute run produces 10–30 readable entries worth screenshotting.
- **Code:** no source file over ~200 lines. Daksh can explain every line.

## 8. Open questions

- Exact balance numbers (metabolism, food per cell, reproduction threshold). Tuned during S1–S5.
- **Balance risk:** many interacting mechanics (seasons × two resources × culture × raids) can
  tip into "everyone dies" or "nothing happens". Feature flags let us add one at a time and tune it.
- How "trade network formed" is measured (a precise definition is needed before the S13 experiments).
- Region names for the History Book (compass regions like "the northern hills" to start; real terrain is parked).
