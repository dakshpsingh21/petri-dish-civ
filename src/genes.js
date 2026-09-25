// genes.js: nature (genes) and nurture (culture) and how they pass to children.
// Pure functions, no DOM, randomness only from the seeded rng.
//
// Every gene is a number in 0..1, so ONE mutate rule works for all of them.
// Genes don't change behavior yet: rules.js starts reading them in S4.

export const GENE_NAMES = ['greed', 'trust', 'aggression', 'memory']; // memory -> real size in S4
export const CULTURE_NAMES = ['greed', 'trust', 'aggression'];

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Founders: every gene uniform in 0..1, so the first generation is as varied as possible.
export function randomGenes(rng) {
  const genes = {};
  for (const name of GENE_NAMES) genes[name] = rng.next();
  return genes;
}

// New genes = base genes + a small random change each, clamped back into 0..1.
// (rng() - rng()) is a "tent" shape centred on 0: small changes are common, big ones rare.
export function varyGenes(baseGenes, amount, rng) {
  const genes = {};
  for (const name of GENE_NAMES) {
    genes[name] = clamp01(baseGenes[name] + (rng.next() - rng.next()) * amount);
  }
  return genes;
}

// Child genes = parent's genes, varied by the mutation rate.
// Flag off -> exact copy (clones), handy as a baseline for experiments.
export function inheritGenes(parentGenes, rng, config) {
  return varyGenes(parentGenes, config.features.mutation ? config.mutationRate : 0, rng);
}

// Culture = offsets added on top of genes (effective trait = clamp01(gene + culture + ...)).
// Founders start neutral. Elders will pull it around in S5.
export function neutralCulture() {
  return { greed: 0, trust: 0, aggression: 0 };
}

// A COPY, never the same object: otherwise parent and child would share one culture,
// and nudging one (elders, S5) would silently change the other.
export function copyCulture(culture) {
  return { ...culture };
}
