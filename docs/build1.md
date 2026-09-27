# BUILD BRIEF — Cross-Border Data Protection Compliance Navigator
Working name: "DataBorders" (placeholder, easy to rename)

## Your operating rules
- Start in plan mode. Produce a plan for Phase 0–1 only, wait for my approval, then build phase by phase. Stop at the end of every phase with a summary, what to test, and open questions.
- Never invent legal content. Anything legal you write into the knowledge base must come with an official source URL and a pinpoint citation (article/section). If you cannot verify something, mark it `confidence: "unverified"`, don't guess.
- Before hardcoding any Anthropic model ID, SDK method or tool version (especially the web search tool), check the current docs at https://docs.claude.com and use what they say.

## Phase 0 — Environment verification (report back before building)
1. Check for installed skills: look in `~/.claude/skills/` and `./.claude/skills/` for a UI/UX design skill. If found, read its SKILL.md fully and follow it for all UI work. Tell me its name and key rules.
2. Check MCP servers (`claude mcp list` and any `.mcp.json`). If the 21st.dev Magic MCP is available, use it for component inspiration and generation, but always adapt its output to OUR design tokens below. Never ship its default styling as-is.
3. Confirm `ANTHROPIC_API_KEY` is present in `.env.local` (don't print it). It must only be used server-side. Never use a `NEXT_PUBLIC_` prefix for it.
4. Report: skill found y/n, Magic MCP found y/n, Node version, and the latest stable Next.js version you'll use.

## Product
A web app where a company answers a structured questionnaire (HQ country, current operating countries, target countries, data processed, IT/governance setup, existing compliance framework) and receives a jurisdiction-by-jurisdiction compliance checklist with concrete next steps, priorities, owners and sources.

Reference case (build the MVP around it, but keep the product general): an Italy-headquartered industrial engineering & project services group with subsidiaries/branches in China, Singapore, Peru, Chile, US (California, Texas), Germany, South Korea and India. It has a GDPR-based framework and centralized privacy governance at HQ.

Core value props:
1. **GDPR delta**: for companies with a GDPR baseline, every obligation is tagged `covered` / `partial` / `new` relative to GDPR, with the GDPR equivalent named (e.g. "Art. 30 RoPA"). This is the headline feature.
2. **Transfer map**: every data flow (subsidiary → HQ, HQ → subsidiary, → vendors) with the transfer mechanism each exporting country requires.
3. **Governance recommendation**: where a purely centralized model breaks (local DPO/representative/filing duties) and what a hub-and-spoke model would look like.
4. **Actionable output**: prioritized checklist + 30/60/90-day roadmap, exportable.

## Stack
- Next.js (App Router, latest stable), TypeScript strict, Tailwind CSS, shadcn/ui, zod for all validation, react-hook-form for the wizard.
- `json-logic-js` (or similar) for applicability rules, so rules are data and not hardcoded if-statements.
- Anthropic TypeScript SDK, server-side only (route handlers / server actions).
- Exports: PDF (react-pdf or similar), DOCX (`docx` package — lawyers will want to edit it), XLSX/CSV checklist.
- No database for MVP: the knowledge base lives in `/content/jurisdictions/*.json`, versioned in git. Report state lives client-side (session) and is shareable via an encoded URL or downloaded file. Design the storage layer behind an interface so a DB can be added later.

## Knowledge base schema (define in zod, validate at build time)
```ts
Jurisdiction {
  id: string            // "CN", "SG", "PE", "CL", "US-CA", "US-TX", "DE", "KR", "IN", "IT"
  name: string
  laws: { title, shortName, citation, officialUrl, status: "in_force"|"enacted_not_in_force"|"draft", effectiveDate? }[]
  regulators: { name, url }[]
  scopeNotes: string    // territorial/extraterritorial scope, thresholds
  obligations: Obligation[]
  upcomingChanges: { title, expectedDate, summary, sourceUrl }[]
  lastReviewed: ISODate
}
Obligation {
  id: string            // "CN-TRANSFER-01"
  category: "governance"|"dpo_representative"|"registration_filing"|"legal_basis_consent"|"notice"|"data_subject_rights"|"security"|"breach_notification"|"cross_border_transfer"|"localization"|"impact_assessment"|"vendors_processors"|"employee_data"|"marketing"|"sensitive_data"|"children"|"automated_decisions_ai"|"records"
  title: string
  requirement: string   // plain-language, 2–4 sentences
  appliesIf: JsonLogic  // evaluated against intake answers
  actionSteps: string[] // concrete steps
  deadlineOrTimeline?: string
  penaltyNote?: string
  owner: "HQ"|"local_entity"|"both"
  priority: "critical"|"high"|"medium"|"low"
  gdprEquivalent?: string
  gdprDelta: "covered"|"partial"|"new"
  sources: { url, pinpoint }[]  // official sources preferred
  lastVerified: ISODate
  verifiedBy: string
  confidence: "verified"|"needs_review"|"unverified"
}
```

## Seed research leads (VERIFY EVERY ONE against official sources. These are leads, not facts)
- IT (HQ baseline): GDPR; Italian Privacy Code (D.Lgs. 196/2003 as amended); Garante.
- DE: GDPR; BDSG (incl. DPO threshold, employee data provisions and their status after CJEU case law); TDDDG; works council co-determination for monitoring tools (BetrVG).
- CN: PIPL, Data Security Law, Cybersecurity Law; cross-border pathways (CAC security assessment / standard contract / certification + exemptions under the 2024 cross-border data flow provisions); PI protection impact assessments; separate consent; Network Data Security Management Regulations; PI compliance audit rules.
- SG: PDPA (as amended); mandatory DPO; breach notification thresholds/timeline; transfer limitation obligation; DNC.
- PE: Law 29733 and its new implementing regulation; ANPD; database registration; DPO and breach notification under the new regulation.
- CL: current Law 19.628 AND new Law 21.719 (new agency, GDPR-like regime). Check the exact entry-into-force date. If it's imminent, flag it prominently.
- US-CA: CCPA/CPRA (employee + B2B data in scope); CPPA regulations on risk assessments, cybersecurity audits and ADMT with their phase-in dates; state breach notification law.
- US-TX: TDPSA (check employment-data exclusion); CUBI biometric law (relevant for site access control/timekeeping); breach notification; any newer AI legislation.
- KR: PIPA (as amended 2023) incl. domestic representative, CPO, cross-border transfer bases; PIPC.
- IN: DPDP Act 2023 + DPDP Rules and their phased commencement dates; Data Protection Board; what remains under IT Act SPDI Rules in the meantime.

Research method: use official regulator/government/legislation sites first, reputable law-firm publications only to locate primary sources. Record every source. Produce a research log per jurisdiction in `/content/research-logs/`.

## Intake questionnaire (multi-step wizard, progress bar, save-and-resume in session)
1. Company: name (optional; note for the firm use case: allow anonymized label), HQ country, industry (engineering/construction preset + others), group headcount.
2. Footprint: for each current/target country → entity type (subsidiary / branch / rep office / none yet), local headcount, operational status (operating / planned).
3. Data subjects & categories: employees, contractors, job applicants, B2B client contacts, consumers/end users, site visitors; sensitive data (health, biometrics, criminal checks, union membership), children's data, precise location, CCTV.
4. Processing: HR/payroll, recruiting, site safety & access control, CCTV, marketing, CRM, R&D/engineering data, monitoring of employees, AI/automated decision-making.
5. Infrastructure & flows: where data is hosted (HQ/EU, local, cloud region), which entities access which data, main vendors/cloud providers (by category), whether local entities process on HQ's behalf or vice versa.
6. Existing framework: checklist of GDPR artifacts in place (RoPA, DPIAs, SCCs/TIAs, DPO, breach procedure, DSAR procedure, vendor DPAs, privacy notices, training, retention schedule).
7. Governance: centralized / hub-and-spoke / decentralized; local privacy contacts exist y/n.
Every question needs a short "why we ask" tooltip (legal reason in one line). Branch logic: skip irrelevant questions.

## Engine
- Pure function `evaluate(intake, knowledgeBase) → Report`. Unit-test it (Vitest) with the reference-case intake as a fixture.
- Report = per-jurisdiction applicable obligations + GDPR delta stats + transfer map + governance findings + roadmap (critical/new items → 30 days; high → 60; rest → 90).

## Claude integration (server-side only, structured outputs, streaming progress UI)
1. `/api/tailor`: takes the deterministic report + intake and writes tailored explanations and step refinements. System prompt: may ONLY use obligations present in the input; must not add, remove or change the legal substance; must cite obligation IDs. Validate output with zod; on failure, fall back to the untailored report.
2. `/api/developments`: per jurisdiction, uses Claude's web search tool (check docs for current tool spec), restricted where possible to official domains, to find changes since `lastReviewed`. Output is shown in a separate, clearly labelled "Recent developments — not yet reviewed" panel with source links. Cache per jurisdiction for 24h. Never merge into the checklist automatically.
3. `/admin/research` (protected by an env-based password for MVP): runs the research pipeline for a jurisdiction and produces a proposed JSON diff against the knowledge base with sources; I approve/reject each change; approved changes are written to the JSON files (in dev) with `verifiedBy` + date.
- Add rate limiting, request size limits, and a cost guard (max tokens/searches per request). Log token usage.

## Pages
- `/` landing: what it does, who it's for, how it works (3 steps), sample report preview, methodology link.
- `/assess` wizard.
- `/report` report view (see Report UI).
- `/jurisdictions` + `/jurisdictions/[id]`: public library pages per country (laws, regulator, key obligations, last reviewed). These are good for SEO for general use.
- `/methodology`: sources, review process, limitations.
- `/legal`: disclaimer, privacy policy, imprint placeholder.

## Report UI
- Executive summary: countries assessed, # obligations, % covered/partial/new vs GDPR, top 5 critical actions, imminent deadlines.
- Heatmap matrix: jurisdictions × categories, cells coloured by delta status, clickable.
- Per-jurisdiction sections: checklist items with checkbox, priority badge, owner, timeline, "GDPR equivalent", action steps, and footnote-style source citations with pinpoints. Show `lastVerified` on every item.
- Transfer map: flow diagram (entity → entity) with required mechanism per flow.
- Governance recommendation section.
- 30/60/90 roadmap.
- Export buttons: PDF, DOCX, XLSX.

## Design direction: "a well-drafted legal opinion, rendered as software"
- Palette as CSS tokens: ink navy (primary), parchment/off-white paper background, charcoal text, a restrained brass/gold accent used sparingly (rules, focus states, key numbers), muted status colours for covered/partial/new (and never colour alone: add labels/icons).
- Typography: a serif for headings (e.g. Source Serif 4 or Libre Caslon) + a clean sans for UI/body (e.g. Inter or IBM Plex Sans), tabular numerals for figures.
- Legal-document cues: numbered paragraphs in the report (1.1, 1.2…), § symbols for section markers, footnote-style citations, thin horizontal rules, generous margins, marginal notes for "why this applies".
- Tone: calm, authoritative, precise. No stock photos of gavels or scales, no gimmicky legal clichés, no gradients-everywhere startup look.
- Full dark mode, responsive down to 360px, WCAG 2.2 AA (keyboard navigation through the whole wizard, visible focus, aria labels), print stylesheet for the report.
- Follow the UI/UX skill from Phase 0 if present; its rules override generic choices here where they conflict, but keep this palette/typography direction.

## Trust, privacy & security (the tool must practise what it preaches)
- Persistent disclaimer: informational tool, not legal advice, verify with qualified counsel; show knowledge-base review dates.
- No intake data persisted server-side in MVP; only sent to Claude for tailoring when the user opts in (checkbox with plain explanation). Offer an anonymized mode (no company name).
- No third-party analytics/trackers by default. Security headers (CSP etc.), zod validation on every API input, secrets only on the server.
- Deploy target: Vercel with an EU region; note it in the privacy policy.

## Phases
0. Environment verification (report, stop)
1. Scaffold, design tokens, typography, layout shell, landing page (stop)
2. KB schema + research + seed JSON for IT, DE, CN, SG, PE, CL, US-CA, US-TX, KR, IN with research logs (stop, I will review the legal content)
3. Intake wizard (stop)
4. Engine + unit tests with reference-case fixture (stop)
5. Report UI incl. heatmap, transfer map, roadmap (stop)
6. Claude tailoring + recent-developments panel (stop)
7. Exports PDF/DOCX/XLSX (stop)
8. Jurisdiction library pages, methodology, legal pages (stop)
9. Admin research pipeline (stop)
10. Polish: accessibility audit, performance, error states, empty states, README with architecture + how to update the KB