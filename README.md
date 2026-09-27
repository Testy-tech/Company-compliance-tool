# DataBorders

Cross-border data protection compliance navigator. A company answers a structured questionnaire and receives a jurisdiction-by-jurisdiction checklist, with each obligation marked **covered / partial / new** relative to GDPR.

The product brief is in [docs/build1.md](docs/build1.md), and the design system in [design-system/databorders/MASTER.md](design-system/databorders/MASTER.md).

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Environment verification | done |
| 1 | Scaffold, design tokens, layout shell, landing page | done |
| 2–10 | Knowledge base, wizard, engine, report, AI, exports, library, admin, polish | pending |

## Develop

Requires Node ≥ 20.9 (developed on Node 24).

```bash
npm install
cp .env.example .env.local   # server-only secrets; never NEXT_PUBLIC_
npm run dev                  # http://localhost:3000
npm run typecheck
npm run lint
npm run build
```

## Stack

Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind CSS v4, shadcn/ui (Radix), zod, react-hook-form, next-themes, lucide-react.
