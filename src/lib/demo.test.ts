import { describe, expect, it } from "vitest";

import { DEMO_BANNER, demoNoticeOn, PRELIMINARY, reviewerConfidence, shownConfidence } from "./demo";

describe("demonstration notice", () => {
  it("is on unless DEMO_NOTICE is set to false", () => {
    expect(demoNoticeOn({})).toBe(true);
    expect(demoNoticeOn({ DEMO_NOTICE: "" })).toBe(true);
    expect(demoNoticeOn({ DEMO_NOTICE: "true" })).toBe(true);
    expect(demoNoticeOn({ DEMO_NOTICE: "0" })).toBe(true);
    expect(demoNoticeOn({ DEMO_NOTICE: "false" })).toBe(false);
    expect(demoNoticeOn({ DEMO_NOTICE: " False " })).toBe(false);
  });

  it("shows a verified entry as preliminary while on, and leaves the other levels alone", () => {
    expect(shownConfidence("verified", true)).toBe(PRELIMINARY);
    expect(shownConfidence("verified", false)).toBe("Verified by counsel");
    expect(shownConfidence("needs_review", true)).toBe("Needs counsel review");
    expect(shownConfidence("unverified", true)).toMatch(/^Unverified/);
  });

  it("qualifies a verified entry for reviewers while on", () => {
    expect(reviewerConfidence("verified", true)).toBe("Marked verified (preliminary)");
    expect(reviewerConfidence("verified", false)).toBe("Verified by counsel");
    expect(reviewerConfidence("needs_review", true)).toBe("Needs counsel review");
  });

  it("uses the agreed banner text", () => {
    expect(DEMO_BANNER).toBe("Preliminary review — content not yet verified by counsel. For demonstration only.");
  });
});
