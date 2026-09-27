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

- **Headcount as a proxy:** § 38 counts *persons constantly engaged in automated processing*, not total headcount. The rule uses local headcount ≥ 20 as a conservative proxy and says so in `appliesIfNote`. The wizard could later ask for the actual number.
- **CJEU C-34/21:** I could not load the judgment from curia/EUR-Lex through the fetch tool. The obligation cites the BfDI's official statement about the judgment instead. **Counsel should add the ECLI pinpoint.**
- **§ 4 BDSG (video surveillance of publicly accessible spaces):** not encoded. I recall case law limiting its applicability to private bodies but could not verify it in this pass. The CCTV item therefore relies on GDPR plus the BfDI guidance.
- **§ 22 and § 24 BDSG** (special categories, change of purpose): not encoded in this pass.
- **Works council scope:** the statute says devices "bestimmt" (designed) to monitor. Case law reads this broadly to cover devices *capable* of monitoring. That reading was not verified here, so the requirement text sticks to the statutory wording and gives examples.

## Open questions for counsel

1. Should § 4 BDSG be encoded, or excluded for private controllers?
2. Should there be a separate item for special-category employee data (§ 26(3) BDSG together with Art. 9(2)(b) GDPR)?
3. Should the wizard ask for the actual "persons constantly engaged in automated processing" count?
