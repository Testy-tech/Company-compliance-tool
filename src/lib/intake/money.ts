import { bandInterval } from "./bands";

/** Conversion table, content/config/fx.json: 1 EUR = rates[CCY]. */
export type FxTable = {
  base: "EUR";
  lastUpdated: string;
  source: string;
  rates: Record<string, number>;
};

/** A monetary threshold as the wizard needs it (resolved to the amount in effect). */
export type MoneyThreshold = {
  id: string;
  jurisdiction: string;
  /** "group.revenueUSD" or "j.revenueUSD" — which revenue answer it is compared with. */
  fact: string;
  amount: number;
  currency: "USD";
  description: string;
  effectiveDate: string;
};

/** EUR revenue band → USD interval (upper bound open for the top band). */
export function revenueBandToUSD(bandId: string, fx: FxTable): [number, number] {
  const rate = fx.rates.USD;
  if (!rate) throw new Error("fx.json has no USD rate");
  const [min, max] = bandInterval("revenueEUR", bandId);
  // max is the last whole euro in the band; the band truly extends to max + 1 (exclusive).
  return [min * rate, Number.isFinite(max) ? (max + 1) * rate : Number.POSITIVE_INFINITY];
}

/** True when some revenue in the band is below the threshold and some is at or above it. */
export function bandStraddles(bandId: string, threshold: MoneyThreshold, fx: FxTable): boolean {
  const [lo, hiExclusive] = revenueBandToUSD(bandId, fx);
  return lo < threshold.amount && threshold.amount < hiExclusive;
}

export const formatUSD = (n: number) => `US$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)}`;
