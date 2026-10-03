import { afterEach, describe, expect, it, vi } from "vitest";

import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

import { libraryIsPublic, libraryPaths, publishable, reviewSplit } from "./publication";
import { knowledgeBase } from "./repository";
import type { Obligation } from "./schema";

afterEach(() => vi.unstubAllEnvs());

const o = (id: string, confidence: Obligation["confidence"]) => ({ id, confidence }) as Obligation;

describe("publication gate", () => {
  it("is closed unless PUBLIC_LIBRARY is exactly \"true\"", () => {
    expect(libraryIsPublic({})).toBe(false);
    expect(libraryIsPublic({ PUBLIC_LIBRARY: "" })).toBe(false);
    expect(libraryIsPublic({ PUBLIC_LIBRARY: "1" })).toBe(false);
    expect(libraryIsPublic({ PUBLIC_LIBRARY: "true" })).toBe(true);
  });

  it("shows only counsel-verified obligations while closed, and counts the rest", () => {
    const list = [o("A", "verified"), o("B", "needs_review"), o("C", "unverified"), o("D", "verified")];
    expect(publishable(list, false)).toMatchObject({ reviewed: 2, pending: 2 });
    expect(publishable(list, false).shown.map((x) => x.id)).toEqual(["A", "D"]);
    expect(publishable(list, true).shown).toHaveLength(4);
    expect(publishable(list, true)).toMatchObject({ reviewed: 2, pending: 2 });
  });

  it("reports the reviewed / pending split of the real knowledge base", async () => {
    const kb = await knowledgeBase.list();
    const split = reviewSplit(kb);
    expect(split.total).toBe(kb.reduce((n, j) => n + j.obligations.length, 0));
    expect(split.reviewed + split.pending).toBe(split.total);
  });

  it("leaves the library out of the sitemap and blocks it in robots.txt while closed", async () => {
    vi.stubEnv("PUBLIC_LIBRARY", "");
    const closed = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(closed.some((p) => p.startsWith("/jurisdictions"))).toBe(false);
    expect(closed).toEqual(expect.arrayContaining(["/", "/methodology", "/legal"]));
    expect(robots().rules).toEqual([expect.objectContaining({ disallow: expect.arrayContaining(["/jurisdictions", "/admin/"]) })]);
  });

  it("lists every jurisdiction page once the gate is open", async () => {
    vi.stubEnv("PUBLIC_LIBRARY", "true");
    const open = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(open).toEqual(expect.arrayContaining(["/jurisdictions", "/jurisdictions/CL", "/jurisdictions/US-CA"]));
    expect(open.filter((p) => p.startsWith("/jurisdictions/"))).toHaveLength(10);
    expect((robots().rules as { disallow: string[] }[])[0]!.disallow).not.toContain("/jurisdictions");
    expect(libraryPaths([{ id: "IT" }], false)).toEqual([]);
  });
});
