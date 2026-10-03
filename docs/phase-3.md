# PHASE 3 ADDENDUM — Threshold questions + "Don't know" handling

Apply this to the intake wizard (Phase 3). It also requires small changes to the
KB schema and the engine contract. Make those now so Phases 4–5 build on them.
Plan first, show me the plan, then implement.

## A. New / rephrased questions

General rules:
- Never use the word "consumers" in the UI; it means different things per law.
- Numeric questions use BANDS, never exact figures (client confidentiality).
- Every question in this addendum has a "Don't know" option. Revenue also has "Prefer not to say".
- Each question keeps a one-line "Why we ask" tooltip (text below).
- Ask per-country questions only for countries the user selected in the footprint step.

### A1. Cross-border transfers (per country where an entity exists)
Label: "Roughly how many individuals' personal data does [entity/country] send outside [country] per calendar year?"
Ask as 3 sub-questions:
- a) Non-sensitive personal data. Bands: 0 | 1–9,999 | 10,000–99,999 | 100,000–999,999 | 1,000,000+ | Don't know
- b) Sensitive personal data (e.g. health, biometrics, precise location, financial accounts, ID numbers, data of minors). Bands: 0 | 1–9,999 | 10,000+ | Don't know
- c) "Is this data mainly employee/HR data needed to manage staff?" Yes, only HR data | Mixed | No | Don't know
Why we ask: "Some countries (notably China) set different transfer procedures depending on how many people's data leaves the country each year."

China-only extra questions (show when CN is selected):
- "Has the China entity been notified that it is a Critical Information Infrastructure Operator (CIIO)?" Yes | No | Don't know
- "Does the China entity handle data that could be classified as 'important data' (e.g. infrastructure, energy, geographic or large-scale project data)?" Yes | No | Don't know
Why we ask: "These statuses can trigger a mandatory government security assessment regardless of volume."

### A2. Revenue
- "Annual revenue of the whole group (worldwide)". Bands in EUR: < 10M | 10–25M | 25–50M | 50–250M | 250M–1B | 1B+ | Don't know | Prefer not to say
- Per local entity: same bands.
Why we ask: "Some laws only apply above a revenue threshold (e.g. California), and several cap fines as a % of revenue."
Store the band. Convert to USD/local currency only inside the engine, using a single documented conversion table in `/content/config/fx.json` with a `lastUpdated` date.

### A3. Employee representation (per entity)
- "Does [entity] have a works council, union, or other employee representative body?" Works council | Union | Both | None | Don't know
- Follow-up if union: "Does [entity] process union membership information (e.g. deducting union dues)?" Yes | No | Don't know
Why we ask: "In some countries (e.g. Germany) introducing HR, monitoring or IT tools legally requires agreement with employee representatives."

### A4. Website and tracking (group-level + per-country websites)
- "Which of these are on your website(s)? (select all)": Analytics (e.g. Google Analytics) | Advertising/retargeting pixels (e.g. LinkedIn Insight Tag, Meta Pixel) | Session recording/heatmaps | Chat widget | Embedded videos/maps | None | Don't know
- "Is there a cookie consent banner?" Yes, blocks trackers until consent | Yes, informational only | No | Don't know
- "Do you run country-specific versions of the website?" Yes (select countries) | No | Don't know
Why we ask: "Trackers trigger consent duties in the EU and opt-out duties in California and Texas, even for B2B websites."

### A5. Number of individuals (per country)
Label: "Roughly how many individuals located in [country] do you hold personal data about per year?" Split into:
- Employees & contractors
- Business contacts (clients, suppliers, partners)
- Other individuals (end users, site visitors, members of the public)
Bands: 0 | 1–9,999 | 10,000–99,999 | 100,000–999,999 | 1M–9,999,999 | 10M+ | Don't know
Why we ask: "Several laws switch on extra duties above certain headcounts, and in California even employees and business contacts count."

## B. Bands must align with legal thresholds
- Define all bands in `/content/config/bands.json` (id, label, min, max, currency/unit).
- Legal thresholds live in the KB (not in UI code).
- Write a Vitest test that loads every numeric threshold referenced in KB rules and fails if any threshold does not fall exactly on a band boundary. This guarantees every rule is decidable from a band.

## C. Answer model
Every threshold answer is stored as:
```ts
type Answer<T> =
  | { status: "known"; value: T }
  | { status: "unknown" }              // "Don't know"
  | { status: "withheld" }             // "Prefer not to say"
```
Define in zod. Both `unknown` and `withheld` are "unresolved".

## D. Engine behaviour for unresolved answers (conservative assumption)
- For each obligation, evaluate `appliesIf` across all possible values of the unresolved fields it references.
  - Applies under every value → `applicability: "applies"`
  - Applies under none → excluded
  - Applies under some → included with `applicability: "assumed"` plus an `assumptions[]` array listing the field, the assumed value, and a plain-English sentence ("Assumed China transfers exceed 1,000,000 individuals/year").
- Tiered/mutually exclusive obligations (e.g. China: exempt / standard contract / security assessment): add optional KB fields `exclusiveGroup: string` and `strictness: number`. When a group's outcome depends on unresolved answers, select the strictest applicable tier, mark it `assumed`, and list the less strict alternatives as "may apply instead if…".
- Exemptions are never assumed. If an exemption depends on an unresolved answer, the obligation applies (assumed).
- Penalty exposure with unknown revenue: show the statutory maximum formula, not a computed figure, with "Revenue not provided".
- Keep evaluation a pure function. Add unit tests for: all-known, single unknown, tiered group with unknown, exemption with unknown, withheld revenue.

## E. Report changes
- Items with `applicability: "assumed"` show a clear "Assumption" badge (icon + text, not colour only) and the assumption sentence inline.
- New report section: **"Assumptions & open questions"**. It groups every unresolved answer, what it affects (obligation IDs + jurisdictions), and a client-facing follow-up question.
- The "Resolve" action on each open question jumps back to that wizard question and recomputes the report on save.
- Executive summary shows the count of assumed items and open questions.
- Export: include the open questions as a standalone "Client follow-up questionnaire" in DOCX and XLSX (question, why it matters, affected countries, answer column).

## F. Acceptance checks
- Reference-case fixture with all threshold answers set to "Don't know" produces a complete report where China shows the security-assessment tier as assumed, California CCPA applicability as assumed, and a follow-up questionnaire listing every open question.
- The same fixture with known low values excludes those obligations.
- The band/threshold alignment test passes.
- The wizard remains fully keyboard-navigable; "Don't know" is a normal radio option, not a hidden link.


1. The core design decision: facts become ranges, not single numbers
The rules currently compare exact numbers, for example "annual transfers ≥ 1,000,000". With banded answers and "Don't know", I'll represent every numeric fact as a range: a known band becomes its minimum and maximum, and an unresolved answer becomes 0 to infinity. The engine then tests each rule at the edges of the range and at any legal threshold inside it:

True at every point: the obligation applies.
False at every point: it's excluded.
Mixed: it's included as assumed, and the case that triggers it becomes the assumption sentence, e.g. "Assumed China transfers exceed 1,000,000 individuals/year".
This one mechanism covers several of your requirements:

"Evaluate across all possible values" (addendum D) is exactly what the range test does.
"Exemptions are never assumed" comes out naturally: an exemption that depends on an unknown answer produces a mixed result, so the obligation is included.
Totals across bands work too, e.g. employees + business contacts + others for California.
Revenue bands that straddle a threshold after currency conversion also resolve to assumed rather than producing a wrong answer.
2. What gets built in Phase 3
Configuration and schemas

content/config/bands.json: every band with id, label, min, max and unit.
content/config/fx.json: EUR base rate, a lastUpdated date, and the source. I'll use ECB reference rates, fetched and cited, not made up.
An intake schema (zod) with the Answer<T> model (known / unknown / withheld), and one schema per wizard step.
A fact registry replacing the current fact list. Each fact has a label, unit, source question (so the report's "Resolve" link can jump to it), a template for its assumption sentence, and a client follow-up question.
Knowledge-base changes

Two new optional fields, exclusiveGroup and strictness, for tiered rules, applied to China's transfer tiers (standard contract, then security assessment).
Every existing rule rewritten for the new facts. For example:
China transfer tiers use the new transfer bands, the "mainly HR data" question, and the CIIO and important-data answers.
California uses total individuals and revenue.
Germany's works-council rule applies to "works council" and "both" answers.
Trackers split into analytics, advertising pixels, session recording and chat widgets.
Engine contract (types only)

ObligationResult with applicability: "applies" | "assumed", assumptions[] and alternatives[], plus OpenQuestion.
The logic itself and its unit tests follow in Phase 4.
Tests

Vitest setup, plus the band alignment test: every count threshold in the rules must fall exactly on a band boundary.
Wizard (/assess) — eight steps, then a review step:

Step	What it asks
1. Company	Anonymised label or name, HQ, industry, group headcount band, group revenue band
2. Footprint	Countries (from the 10 covered) with role and status; per country: entity type, local headcount band, local revenue band, employee representation (plus the union-data follow-up)
3. People and data	Per country: individuals by group; data subject types; sensitive data categories
4. Processing	Activities (HR, recruiting, site access, CCTV, marketing, AI, …)
5. Infrastructure and flows	Hosting, access from abroad, vendors; per country: the three transfer questions; China-only CIIO and important-data questions
6. Website and tracking	The addendum's tracker, consent-banner and country-site questions
7. Existing GDPR framework	Checklist of what's in place
8. Governance	Centralised / hub-and-spoke / decentralised; local privacy contacts
Review	Summary of answers
Wizard behaviour

Progress bar, back/next, and per-step validation.
Answers are saved to this browser session only, through a storage interface so a database can replace it later.
Per-country questions appear only for the countries selected.
"Don't know" is an ordinary radio option.
Every question has a "Why we ask" help button that works by keyboard and touch. I'm not using hover tooltips because they fail on mobile and for screen readers.
The word "consumers" never appears in the UI.
End of Phase 3: you'll get the wizard running end to end with answers saved per session, the alignment test passing, and the KB migrated and valid. The report still isn't built (Phase 5).

3. Where the addendum lands in later phases
D (engine behaviour): Phase 4, with all five required tests plus the reference-case fixture.
E (report changes): Phase 5.
Follow-up questionnaire export: Phase 7.
F (acceptance checks): fully verifiable at the end of Phase 5, and for the export at Phase 7.
4. Conflicts in the addendum that need your decision
Revenue bands in EUR can't sit exactly on the US-dollar thresholds. California's threshold is $26,625,000. After conversion, the "€10–25M" band straddles it, so a company answering that band can't be classed with certainty.
Recommended: keep your EUR bands. The alignment test checks count thresholds exactly and lists any straddling revenue bands in a documented allowlist. A company in a straddling band gets an honest "assumed" result.
Alternative: add a boundary inside that band.
California's cybersecurity audit uses 250,000 individuals and 50,000 with sensitive data, which don't sit on the proposed bands. I recommend:
splitting the individuals band into "100,000–249,999 | 250,000–999,999";
adding a per-country question: "Roughly how many individuals located in [country] do you hold sensitive personal data about per year?", with bands 0 | 1–9,999 | 10,000–49,999 | 50,000+ | Don't know.
Headcount bands need boundaries at 20 (Germany's DPO threshold) and 500 (my Texas small-business stand-in). I propose 0 | 1–19 | 20–49 | 50–249 | 250–499 | 500–4,999 | 5,000+ | Don't know, for both the group and each local entity.
Country list: the footprint step would offer only the 10 covered jurisdictions (US split into California and Texas), with a note that other countries aren't assessed yet. Is that OK?
Reply "go" to accept all four recommendations, or tell me which to change.


Go, with these changes:

1. Revenue straddle: keep EUR bands + documented allowlist. Additionally, when a group/entity revenue band straddles a USD threshold, show a conditional yes/no follow-up ("Is annual revenue above US$[threshold from KB]?") that resolves it. Store all monetary thresholds in the KB with an effectiveDate so inflation adjustments are a data change. Revenue-tiered deadlines (e.g. California cybersecurity audit timing) may also go on the allowlist.

2. California: accept the 100,000–249,999 | 250,000–999,999 split and the new per-country sensitive-data question. Correct the CCPA count rule: the 100,000 test counts individuals whose data is bought, sold or shared (incl. via advertising pixels), not total individuals held. Add a per-country question: "Roughly how many individuals located in [country] have their data sold or shared with third parties for advertising (e.g. via ad pixels)?" using the same bands + Don't know. The 250k/50k cybersecurity audit thresholds stay on data processed.

3. Headcount bands accepted (0 | 1–19 | 20–49 | 50–249 | 250–499 | 500–4,999 | 5,000+ | Don't know). But:
   - Germany DPO: BDSG §38 counts persons regularly engaged in automated processing, not total headcount. Use headcount only as a proxy: if the band is ≥20, the result is "assumed", with the follow-up "How many people at [entity] regularly work with personal data on computers?". Also keep the separate DPO trigger when processing requires a DPIA.
   - Texas: drop the 500-employee stand-in. SBA size standards are industry-specific (engineering services are revenue-based). Replace with a direct question: "Does [entity] qualify as a small business under US SBA size standards?" Yes | No | Don't know, with a link to the SBA size standards tool in the help text.

4. Country list: footprint/target countries limited to the 10 covered, with a note. But the HQ selector allows any country; the GDPR-delta feature only activates when the user indicates a GDPR baseline. Add a free-text "Other countries you operate in (not yet assessed)" field; the report lists these as not assessed.