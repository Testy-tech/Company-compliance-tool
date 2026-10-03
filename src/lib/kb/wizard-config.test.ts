import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { FxTable } from "@/lib/intake/money";

import { jurisdictionSchema } from "./schema";
import { wizardConfigAt, wizardSource } from "./wizard-config";

const content = path.join(process.cwd(), "content");
const kb = readdirSync(path.join(content, "jurisdictions")).map((f) => jurisdictionSchema.parse(JSON.parse(readFileSync(path.join(content, "jurisdictions", f), "utf8"))));
const fx = JSON.parse(readFileSync(path.join(content, "config", "fx.json"), "utf8")) as FxTable;

describe("wizard thresholds", () => {
  const source = wizardSource(kb, fx);
  const amount = (date: string) => wizardConfigAt(source, date).moneyThresholds.find((t) => t.id === "US-CA-CCPA_REVENUE")?.amount;

  it("uses the amount in effect on the assessment date, not on the build date", () => {
    expect(amount("2026-10-03")).toBe(26625000);
    expect(amount("2024-06-01")).toBe(25000000);
  });

  it("has no threshold before the first entry takes effect", () => {
    expect(amount("2020-01-01")).toBeUndefined();
  });

  it("links each threshold to the revenue answer it is compared with", () => {
    expect(wizardConfigAt(source, "2026-10-03").moneyThresholds.find((t) => t.id === "US-CA-CCPA_REVENUE")).toMatchObject({ jurisdiction: "US-CA", fact: "group.revenueUSD" });
  });
});
