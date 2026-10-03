# Research log — Italy (IT)

- **Researched:** 2026-09-27 by claude-research. **Status:** pending counsel review. All obligations are `needs_review`.
- **Method:** primary texts only, from the Garante's consolidated Privacy Code PDF, Normattiva, the Gazzetta Ufficiale, EUR-Lex and the European Commission.

## Sources consulted

| # | Source | What was confirmed |
|---|---|---|
| 1 | Garante, *Codice … (Testo coordinato)* PDF, linked from https://www.garanteprivacy.it/codice. The consolidated text notes amendments through D.L. 19/2026 conv. L. 50/2026 | Verbatim text of Arts. 2-septies, 2-octies, 2-quaterdecies.1, 113, 114, 130, 171 |
| 2 | Normattiva, L. 300/1970 Art. 4 | Remote monitoring: permitted purposes; union agreement or INL authorisation; exemption for work tools and attendance systems; information condition for use of data |
| 3 | Normattiva, D.Lgs. 152/1997 Art. 1-bis | Information duty on fully automated decision/monitoring systems; content; 24-hour notice of changes; information to unions |
| 4 | Gazzetta Ufficiale n. 223 of 25 Sept 2025 (PDF), L. 132/2025 | Art. 11(2) text: employer must inform workers of AI use per Art. 1-bis D.Lgs. 152/1997. Entry into force 10 Oct 2025 |
| 5 | EUR-Lex, GDPR | Pinpoints for Arts. 12–14, 15–22, 28, 30, 32–37, 44–49, 83(5) |
| 6 | European Commission adequacy decisions page (read 2026-09-27) | Korea adequate (first review completed July 2026); US adequate for DPF participants only; Brazil adequate since Jan 2026; CN, SG, PE, CL, IN not adequate |
| 7 | Commission digital-strategy news "AI Omnibus enters into force" | In force 27 July 2026; Annex III high-risk from 2 Dec 2027; Annex I from 2 Aug 2028 |
| 8 | European Parliament Legislative Train and Council document register | Digital Omnibus (GDPR/ePrivacy) still under negotiation in June 2026 |

## Findings and judgement calls

- **The GDPR baseline is recorded under IT.** Core GDPR obligations (RoPA, DPO, transfers, breach, DPIA, processors, notices, rights, security) are stored as IT items marked `covered`. The DE file lists only German additions, to avoid duplicates.
- **Art. 2-quaterdecies.1** (new, D.L. 19/2026) creates a simplified breach-notification procedure for businesses with fewer than 5 employees. It is not relevant to the reference group, so it is not encoded.
- **Biometric attendance systems:** Art. 2-septies(7) allows biometrics for *physical and logical access to data*. I did not verify the Garante's current position on biometric *attendance* systems for workers, so the obligation tells the user to get Italian counsel's view rather than stating a rule.
- **DPIA list:** the Garante publishes a list of processing types that require a DPIA. I did not open it in this pass, so it is referenced generically.
- **IT-EMPLOYEE-01 penalty:** Art. 171 of the Code refers to the sanctions of Art. 38 of L. 300/1970. I did not verify the amounts in Art. 38 itself.

## EU outbound transfers per destination (added 2026-10-03)

- The engine now picks a mechanism for each flow whose exporter is in the EEA, by destination. The data is in `content/config/eu-transfers.json`, not in this jurisdiction file, because it applies to any EEA exporter (Italy and Germany today).
- **Adequacy list:** re-read the Commission's adequacy page on 2026-10-03 (the page shows a last update of 23 July 2026). It lists sixteen countries or territories; the file records each with a scope note where the page gives one (Canada: commercial organisations; United States: organisations certified under the Data Privacy Framework). The European Patent Organisation is also listed but is not a country destination and is not encoded.
- **Mechanism per destination:** inside the EEA, none; adequate country, the adequacy decision (Art. 45); a US group entity, the Data Privacy Framework if it is certified (new wizard question), otherwise standard contractual clauses with a transfer impact assessment (Art. 46(2)(c)); every other destination, standard contractual clauses with a transfer impact assessment. Unknown certification or an unknown destination is treated as the clauses route and marked as an assumption.
- **Not encoded:** binding corporate rules, Art. 49 derogations, and the scope limits of individual decisions beyond the two noted. US service providers are shown as "clauses unless the provider is certified", because certification is a fact about each provider that the wizard does not ask. The Data Privacy Framework decision number (Implementing Decision (EU) 2023/1795) is cited from memory of the Official Journal reference and should be checked. **Counsel should confirm** this section.

## Open questions for counsel

1. Should the Italian Garante DPIA list (2018) be encoded item by item?
2. Should the Art. 130 soft opt-in be marked `partial` or `new`? Its source is the ePrivacy Directive, not the GDPR.
3. What is the Garante's position on biometric attendance or site-access systems at construction sites?
