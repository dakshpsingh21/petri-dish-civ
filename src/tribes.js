// tribes.js: tribes = lineages. Each has a name, a colour and "founder genes".
// Pure sim code: no DOM, randomness only from the seeded rng.

const SYLLABLES = ['ka', 'ru', 'vel', 'mi', 'to', 'sha', 'dor', 'an', 'el', 'ish', 'ur', 'zen',
  'bo', 'ran', 'thi', 'ol', 'mar', 'sen', 'ga', 'lo', 'fen', 'ya', 'kor', 'di'];

// The golden angle (360 / phi^2 ~ 137.5 deg). Stepping round the colour wheel by it puts each
// new hue in the biggest gap left by the earlier ones, so tribe colours never bunch up.
const GOLDEN_ANGLE = 137.508;

export function createTribes() {
  return { byId: new Map(), nextId: 1, usedNames: new Set() };
}

// 2-3 seeded syllables, capitalised: "Karuvel", "Mito", "Shadoran".
// Retry a few times to avoid duplicates; after that, add a numeral ("Mito II").
function makeName(rng, used) {
  let name = '';
  for (let attempt = 0; attempt < 20; attempt++) {
    const count = 2 + rng.int(2);
    name = '';
    for (let i = 0; i < count; i++) name += SYLLABLES[rng.int(SYLLABLES.length)];
    name = name[0].toUpperCase() + name.slice(1);
    if (!used.has(name)) break;
  }
  let unique = name;
  for (let n = 2; used.has(unique); n++) unique = `${name} ${'I'.repeat(n)}`;
  used.add(unique);
  return unique;
}

// Create a tribe and announce it. parentTribeId = 0 for the starting tribes.
export function foundTribe(tribes, founderGenes, tick, parentTribeId, rng, bus) {
  const id = tribes.nextId++;
  const tribe = {
    id,
    name: makeName(rng, tribes.usedNames),
    hue: (id * GOLDEN_ANGLE) % 360,
    founderGenes: { ...founderGenes },   // a copy: drift from these -> split (step 5)
    parentTribeId,
    population: 0,
    foundedTick: tick,
    extinctTick: null,                   // stays in the Map after death: the History Book needs names
  };
  tribes.byId.set(id, tribe);
  const parentName = parentTribeId ? tribes.byId.get(parentTribeId).name : null;
  bus.emit('tribe:founded', { tick, tribeId: id, name: tribe.name, parentTribeId, parentName });
  return tribe;
}

// Recount every tribe's population from scratch (always correct, never drifts),
// then announce any tribe that just hit 0.
export function updatePopulations(tribes, agents, tick, bus) {
  for (const tribe of tribes.byId.values()) tribe.population = 0;
  for (const agent of agents) tribes.byId.get(agent.tribeId).population++;
  for (const tribe of tribes.byId.values()) {
    if (tribe.population === 0 && tribe.extinctTick === null) {
      tribe.extinctTick = tick;
      bus.emit('tribe:extinct', { tick, tribeId: tribe.id, name: tribe.name });
    }
  }
}

export function livingTribes(tribes) {
  return [...tribes.byId.values()].filter(t => t.extinctTick === null);
}
