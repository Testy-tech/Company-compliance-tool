# Research log — Germany (DE)

- **Researched:** 2026-09-27 by claude-research. **Status:** pending counsel review. All obligations are `needs_review`.

## Sources consulted

| # | Source | What was confirmed |
|---|---|---|
| 1 | gesetze-im-internet.de, BDSG § 38 | DPO threshold: at least 20 persons constantly engaged in automated processing, or DPIA / commercial transfer or market research, regardless of headcount |
| 2 | gesetze-im-internet.de, BDSG § 6(4) | DPO removal only by analogy to § 626 BGB; dismissal protection, including for one year after the role ends (applies to mandatory DPOs via § 38(2)) |
| 3 | gesetze-im-internet.de, BDSG § 26 | Text of paras. 1–3 still in force |
| 4 | BfDI FAQ Beschäftigtendatenschutz | BfDI: § 26 "reicht … nicht aus" in light of CJEU C-34/21 (30 Mar 2023); employee data act planned by BMI/BMAS; blanket CCTV generally inadmissible |
| 5 | gesetze-im-internet.de, TDDDG § 25 | Consent for device storage/access; strictly-necessary exemption; the act's name is now TDDDG |
| 6 | gesetze-im-internet.de, BetrVG § 87 | Co-determination over technical devices designed to monitor behaviour or performance; Einigungsstelle decides if there is no agreement |
| 7 | Bundestag Drucksache 21/7732 (26 Aug 2026) | Bundesrat bill: DSK institutionalised, national one-stop-shop for affiliated companies, "Einer-für-Alle" principle. No DPO threshold change |
| 8 | Bundestag search results for "BDSG Änderung … Schwelle 50" | No official evidence of a pending change to the 20-person threshold was found |

## Findings and judgement calls

- **DPO count (updated in Phase 3):** § 38 counts *persons constantly engaged in automated processing*, not total headcount. The rule now reads `j.dataStaff` (the wizard asks how many people at the German entity regularly work with personal data on computers) instead of `j.headcount`. Decision of 2026-10-03 for the Phase 4 engine: when the data-staff question is unanswered, local headcount is its upper bound, because data staff cannot exceed headcount. Headcount 0 or 1–19 therefore excludes the headcount trigger with certainty; headcount of 20 or more (or unknown) makes the DPO item "assumed", with the data-staff question as the follow-up. The separate trigger for processing that needs a DPIA is unchanged (employee monitoring and biometrics are used as indicators).
- **Works council (updated in Phase 3):** the co-determination item applies when the employee-representation answer is "works council" or "both". A union alone does not trigger § 87 BetrVG.
- **Trackers (updated in Phase 3):** the TDDDG § 25 item now reads `web.nonEssential`, derived from the website step (analytics, advertising pixels, session recording, chat widget, embedded content).
- **CJEU C-34/21:** I could not load the judgment from curia/EUR-Lex through the fetch tool. The obligation cites the BfDI's official statement about the judgment instead. **Counsel should add the ECLI pinpoint.**
- **§ 4 BDSG (video surveillance of publicly accessible spaces):** not encoded. I recall case law limiting its applicability to private bodies but could not verify it in this pass. The CCTV item therefore relies on GDPR plus the BfDI guidance.
- **§ 22 and § 24 BDSG** (special categories, change of purpose): not encoded in this pass.
- **Works council scope:** the statute says devices "bestimmt" (designed) to monitor. Case law reads this broadly to cover devices *capable* of monitoring. That reading was not verified here, so the requirement text sticks to the statutory wording and gives examples.

## Open questions for counsel

1. Should § 4 BDSG be encoded, or excluded for private controllers?
2. Should there be a separate item for special-category employee data (§ 26(3) BDSG together with Art. 9(2)(b) GDPR)?
3. Is "regularly work with personal data on computers" an acceptable plain-language rendering of the § 38 test for the wizard question?
