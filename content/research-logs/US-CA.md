# Research log — United States: California (US-CA)

- **Researched:** 2026-09-27 by claude-research. **Status:** pending counsel review. All obligations are `needs_review`.

## Sources consulted

| # | Source | What was confirmed |
|---|---|---|
| 1 | cppa.ca.gov/regulations/cpi_adjustment.html | Revenue threshold USD 26,625,000 (from 1 Jan 2025); fines USD 2,663 / 7,988; private right of action USD 107–799 |
| 2 | cppa.ca.gov/faq.html | Thresholds; employee and B2B exemptions expired 31 Dec 2022 |
| 3 | Approved regulation text (ccpa_updates_cyber_risk_admt_appr_text.pdf) | § 7001(ddd) significant decision (incl. employment); § 7120 audit applicability (250k consumers / 50k sensitive); § 7121 audit dates 1 Apr 2028 / 2029 / 2030; § 7150(b) risk triggers incl. HR-administration exception and employee inference; § 7155(b)–(c) existing processing by 31 Dec 2027 and retention; § 7157(a) submission by 1 Apr 2028; § 7200 ADMT by 1 Jan 2027 |
| 4 | CalPrivacy "7 Things to Know Before 2026" (PDF) | Regs effective 1 Jan 2026; opt-out status (§§ 7025(c)(6), 7026(g)); 2022 lookback; correction rules (§ 7023); under-16 data treated as sensitive |
| 5 | cppa.ca.gov/regulations/ | Agency branding "CalPrivacy"; preliminary 2026 rulemakings (employee data, notices, OOPS, friction, data broker audits); no proposed packages |
| 6 | leginfo, Civ. Code § 1798.82 | **Amended by SB 446 (Stats. 2025, ch. 319), eff. 1 Jan 2026:** consumer notice within 30 calendar days; AG sample within 15 days if more than 500 residents |
| 7 | oag.ca.gov breach reporting page | AG sample for more than 500 residents; § 1798.82(f) |

## Findings and judgement calls

- **Breach timing changed.** The old "most expedient time" standard has been replaced by a fixed 30-day deadline. This is flagged as a notable 2026 change.
- **Group revenue vs entity revenue:** the rule compares `group.revenueUSD` with the threshold. Whether worldwide group revenue counts depends on the entity and affiliate analysis ("controls or is controlled by" plus common branding). **Counsel should confirm.**
- **Applicability rule (updated in Phase 3):** every CCPA item now tests "revenue at or above the threshold, OR 100,000+ Californians whose data is bought, sold or shared". The count test reads `j.people.soldShared` (a new wizard question that mentions advertising pixels), not total individuals held. The third statutory route (half or more of revenue from selling or sharing) is not asked in the wizard and is not encoded.
- **Revenue threshold as dated data (Phase 3):** the amount lives in `thresholds` as `US-CA-CCPA_REVENUE` with two entries (25,000,000 before the adjustment; 26,625,000 from 1 Jan 2025). Rules reference the id, so the next CPI adjustment is a data change. The pre-2025 figure was not re-checked against an official page in this pass; it only matters for assessment dates before 2025.
- **EUR bands vs the USD threshold:** the "€10–25M" and "€25–50M" bands can straddle the threshold depending on the exchange rate. A straddling answer triggers a yes/no follow-up in the wizard; if that is unanswered the items come out "assumed". Straddles are listed in the alignment test's allowlist.
- **Cybersecurity audit:** applicability uses 250,000 individuals held (`j.people.total`) or 50,000 with sensitive data (`j.people.sensitive`), both on band boundaries. The revenue tiers that set the first report's due date (USD 50M / 100M) are described in the text only and are not rule thresholds.
- **Opt-out item:** triggered by advertising pixels (`web.adPixels`) or any sold/shared count above zero.
- **Statutory pinpoints** (§§ 1798.100, .105, .106, .110, .120, .121, .130, .135) were checked against the CPPA-hosted statute PDF ("effective 01/01/2026 – AB 137, AB 566 update"), including the 45-day response period with a 45-day extension. Note: the CPPA file named `ccpa_statute_eff_20260101.pdf` actually contains the *regulations*; the statute is at `/pdf/20260101_ccpa_statute.pdf`.
- **Not encoded:** data broker duties (Delete Act / DROP), children's rules, and the financial-incentive notice.

## Open questions for counsel

1. Does the US subsidiary's own revenue, or the group's, determine CCPA applicability for the reference case?
2. Does badge or site-access analytics amount to "systematic observation" of employees under § 7150(b)(4)?
