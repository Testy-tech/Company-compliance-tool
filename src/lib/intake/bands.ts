import bandsJson from "../../../content/config/bands.json";

export type Band = { id: string; label: string; min: number; max: number | null };
export type BandSetId = keyof typeof bandsJson.sets;
export type BandSet = { unit: string; currency?: string; bands: Band[] };

export const bandSets = bandsJson.sets as Record<BandSetId, BandSet>;

export function bandIds(set: BandSetId): [string, ...string[]] {
  const ids = bandSets[set].bands.map((b) => b.id);
  return ids as [string, ...string[]];
}

export function findBand(set: BandSetId, id: string): Band | undefined {
  return bandSets[set].bands.find((b) => b.id === id);
}

/** Inclusive interval [min, max] for a band; max = Infinity when open-ended. */
export function bandInterval(set: BandSetId, id: string): [number, number] {
  const b = findBand(set, id);
  if (!b) throw new Error(`Unknown band "${id}" in set "${set}"`);
  return [b.min, b.max ?? Number.POSITIVE_INFINITY];
}

/** Band boundaries (each band's min), i.e. values at which a "≥ x" rule can flip decidably. */
export function bandBoundaries(set: BandSetId): number[] {
  return bandSets[set].bands.map((b) => b.min);
}
