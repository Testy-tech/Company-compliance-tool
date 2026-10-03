# Research log — United States: Texas (US-TX)

- **Researched:** 2026-09-27 by claude-research. **Status:** pending counsel review. All obligations are `needs_review`.
- **Access limitation:** statutes.capitol.texas.gov is now a JavaScript application, and both its HTML and PDF endpoints returned an app shell. I relied on **enrolled bill texts** on capitol.texas.gov (official enacted text) and on the Texas AG's pages.

## Sources consulted

| # | Source | What was confirmed |
|---|---|---|
| 1 | HB 4 (88R) enrolled, capitol.texas.gov | § 541.001(7) "consumer" excludes commercial/employment context; § 541.002 applicability (not an SBA small business); § 541.052 45+45 days; § 541.101 duties incl. sensitive-data consent; § 541.104(b) processor contract terms; § 541.105 assessments; § 541.107 small-business sensitive-data sale; §§ 541.154–.155 30-day cure, USD 7,500 per violation |
| 2 | SB 768 (88R) enrolled | § 521.053(i): AG notice ≤ 30 days (was 60) for 250+ Texans, via online form |
| 3 | Texas AG Data Breach Reporting (search summary from the official domain) | Individuals ≤ 60 days; AG ≤ 30 days; electronic form since 1 Sept 2023 |
| 4 | Texas AG CUBI overview page | Consent before capture; limits on disclosure; reasonable care; destroy within one year after the purpose expires; up to USD 25,000 per violation |
| 5 | HB 149 (89R) enrolled | § 503.001 amendments (AI-training and security exemptions; publicly available images ≠ consent) |
| 6 | HB 149 Senate committee analysis | TRAIGA effective 1 Jan 2026; private-sector prohibitions; 60-day cure; penalty bands |

## Findings and judgement calls

- **The TDPSA employment exclusion is decisive for the reference case.** For a B2B engineering group, only CUBI (employee biometrics) and ch. 521 (breach) are likely to apply. TDPSA items require `subjects.endUsers` and people in the "other individuals" band.
- **Small business (updated in Phase 3):** the 500-employee stand-in was dropped. The wizard now asks directly whether the Texas entity qualifies as an SBA small business, and an unknown answer makes TDPSA items "assumed".
- **Sensitive-data consent split (2026-10-03):** re-read HB 4 enrolled. § 541.002(a) excludes SBA small businesses from the chapter, and § 541.002(b) / § 541.107 carve one duty back in: a small business needs prior consent to sell a consumer's sensitive data. The KB now has two items. `US-TX-SENSITIVE-02` is the full consent duty for processing sensitive data (§ 541.101(b)(4)) and now carries the small-business exclusion like the other TDPSA items. `US-TX-SENSITIVE-03` is the sale-consent duty and ignores small-business status. Note on ids: `US-TX-SENSITIVE-01` was already the CUBI biometrics item, so the split uses -02 and -03.
- **Sale question (2026-10-03, replaces the earlier sold/shared proxy):** `US-TX-SENSITIVE-03` now reads `j.tx.sale`, a Texas-only yes/no question asking whether personal data of Texas residents is exchanged with third parties for money or other valuable consideration. Re-read § 541.001(28): the definition has three elements (a controller shares, discloses or transfers personal data; to a third party; in return for monetary or other valuable consideration) and the question wording follows them. The five listed exclusions, (A) to (E), cover processors acting for the controller, a third party providing something the consumer asked for, affiliates, information the consumer made public, and mergers or similar transactions; the question's help text mentions three of them and none are encoded as rules. The generic sold-or-shared count no longer triggers the item: it only decides whether the question is asked (count above zero or unknown). "Yes" applies, "No" excludes, "Don't know" gives "assumed". Whether pixel-based sharing amounts to "valuable consideration" in Texas is left to the person answering; **counsel should confirm**.
- **Overlap:** for a business that is not small, both -02 and -03 can appear; -03 adds nothing beyond -02 in that case.
- **CUBI and employers:** I did not verify from the statute text whether an employer's capture for timekeeping counts as a "commercial purpose", or any employment-specific presumption on when the purpose expires. **Counsel should confirm.**
- **TRAIGA penalty amounts** come from the committee analysis, not the enrolled text, so they are not repeated in obligation text.

## Open questions for counsel

1. Does CUBI apply to employer biometric time clocks, and how should the destruction period run for employees?
2. What is the reference group's US subsidiary's SBA size status?
