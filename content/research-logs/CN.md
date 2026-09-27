# Research log — China (CN)

- **Researched:** 2026-09-27 by claude-research. **Status:** pending counsel review. 18 obligations are `needs_review` and 1 is `unverified` (CN-LOCALIZATION-01).
- **Method:** Chinese-language official texts were downloaded from cac.gov.cn and gov.cn and read in the original. Machine translation of numeric thresholds proved unreliable (see the note below), so every threshold was checked against the Chinese text.

## Sources consulted

| # | Source | What was confirmed (from original Chinese text) |
|---|---|---|
| 1 | PIPL, cac.gov.cn/2021-08/20/c_1631050028355286.htm | Arts. 3, 13 (incl. last para: consent not needed where items 2–7 apply), 17, 21, 23, 24, 26, 28–29, 38–41, 44, 50–57, 66 |
| 2 | CBDF Provisions (CAC Order 16), cac.gov.cn 2024-03-22 | Art. 2 (important data only if notified/published); Art. 5 exemptions incl. (2) HR under lawful labour rules and (4) <100k non-sensitive; Art. 7 security assessment ≥1M / ≥10k sensitive; Art. 8 SC or certification 100k–<1M / <10k sensitive; counting from 1 Jan of the current year |
| 3 | CAC Data Export Q&A, 11 Sept 2026 | Certification band confirmed; thresholds unchanged; no splitting of volumes; prior notice, separate consent and PIPIA before certification |
| 4 | PI Compliance Audit Measures (CAC Order 18), in force 1 May 2025 | Art. 3 regular audits; Art. 4 >10M individuals → at least every 2 years; Art. 5 ordered audits (incl. breach ≥1M / ≥100k sensitive); Art. 12 ≥1M → PI protection officer; Annex guideline items (incl. 11 on public-place cameras, 15 on transfers incl. SC filing) |
| 5 | CAC Announcement on PI protection officer reporting (18 Jul 2025), from official-site search results | ≥1M individuals → report within 30 working days; updates within 30 working days (read via the search summary; **counsel to open the notice**) |
| 6 | Incident Reporting Measures, in force 1 Nov 2025 | Art. 4: "other network operators" report to the provincial CAC within 4 hours; Annex: leak of ≥1M persons' PI = "relatively major" incident; Art. 5 vendor cooperation |
| 7 | NDSR (State Council Decree 790), in force 1 Jan 2025 | Art. 21 processing-rules content (list form); Art. 28 (≥10M persons → Arts. 30, 32 duties); Arts. 29–30 important data |
| 8 | SCC Measures (CAC Order 13), from official-site search results | Filing with the provincial CAC within 10 working days of effectiveness, together with the PIPIA |
| 9 | Certification Measures, cac.gov.cn 2025-10-17 | In force 1 Jan 2026; same band as SC; certificate valid 3 years |
| 10 | CSL amendment (NPCSC 28 Oct 2025), gov.cn | In force 1 Jan 2026; PI violations penalised under the PIPL; higher CSL fine bands |

## Findings and judgement calls

- **Translation hazard:** the WebFetch English summary of CBDF Art. 8 read "10 million or more but fewer than 1 million". The original text says 10万 (100,000). Only the original Chinese was used.
- **Separate consent for transfers (Art. 39) vs Art. 13 last paragraph:** the obligations say separate consent is required *where consent is the basis* and that the notice and PIPIA duties always apply. This reflects the statutory text. Practice and regulator expectations may differ, so **counsel should confirm**.
- **Remote access by HQ** is treated as provision abroad (`groupAccessFromAbroad` triggers the transfer items). This is common regulatory practice, but I did not verify it against an official text in this pass.
- **CN-LOCALIZATION-01 is `unverified`:** PIPL Art. 40 refers to a "CAC-prescribed amount". I did not locate the currently applicable figure for non-CIIO handlers. The rule flags it at ≥1M individuals as a conservative trigger.
- **Volume facts:** the thresholds use `j.individuals` / `j.sensitiveIndividuals` as proxies for the annual *outbound* volume. The wizard should ask for outbound volume, excluding exempt HR flows, to sharpen this.
- **Not encoded:** the Data Security Law in detail; CIIO obligations; minors' rules beyond sensitive data; Art. 53 representative (it applies to offshore handlers under Art. 3(2), which is not the reference case); algorithm and generative-AI rules.
- **Upcoming changes:** none verified. The CAC's 2026 enforcement campaigns and the draft rules on large platforms were seen in search results but not read, and are not relevant to a B2B engineering group.

## Open questions for counsel

1. What is the current localisation threshold under PIPL Art. 40 for non-CIIO handlers?
2. Does separate consent apply to HR transfers relying on Art. 13(1)(2)?
3. Is the reference group's project data likely to fall within any industrial important-data catalogue?
