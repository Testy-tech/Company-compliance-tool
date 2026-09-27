# DataBorders

Cross-border data protection compliance navigator. A company answers a structured questionnaire and receives a jurisdiction-by-jurisdiction checklist, with each obligation marked **covered / partial / new** relative to GDPR.

The product brief is in [docs/build1.md](docs/build1.md), and the design system in [design-system/databorders/MASTER.md](design-system/databorders/MASTER.md).

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Environment verification | done |
| 1 | Scaffold, design tokens, layout shell, landing page | done |
| 2 | KB schema + validator, 10 jurisdictions (105 obligations), research logs | done — **pending counsel review** |
| 3–10 | Wizard, engine, report, AI, exports, library, admin, polish | pending |

## Develop

Requires Node ≥ 20.9 (developed on Node 24).

```bash
npm install
cp .env.example .env.local   # server-only secrets; never NEXT_PUBLIC_
npm run dev                  # http://localhost:3000
npm run typecheck
npm run lint
npm run build                # runs validate:kb first
npm run validate:kb          # schema + cross-field checks on content/jurisdictions
npm run check:links          # (network) checks every cited URL
```

## Knowledge base

- `content/jurisdictions/<ID>.json` — one file per jurisdiction, validated by `src/lib/kb/schema.ts` (zod) and `src/lib/kb/validate.ts` (ids, JsonLogic operators, allowed fact paths, official-source domains, `verified` reserved for counsel).
- `content/research-logs/<ID>.md` — sources consulted, judgement calls and open questions per jurisdiction.
- `src/lib/kb/facts.ts` — the only facts an `appliesIf` rule may reference; the intake wizard must collect them.
- Confidence: `verified` (counsel only) · `needs_review` (checked against official text by research) · `unverified` (could not be confirmed).

## Stack

Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind CSS v4, shadcn/ui (Radix), zod, react-hook-form, next-themes, lucide-react.
