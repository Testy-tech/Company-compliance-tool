# DataBorders design system: master

Direction: "a well-drafted legal opinion, rendered as software". This file is the source of truth for UI work. Page-specific overrides go in `pages/<page>.md`.

Derived from the `ui-ux-pro-max` skill (`--design-system`: *Trust & Authority* pattern, *Minimalism & Swiss* style, variance 3, motion 2, density 5), with the brief's palette and typography taking precedence over the skill's suggested navy/gold and EB Garamond/Lato.

## Tokens (defined in `src/app/globals.css`)

| Role | Light | Dark | Use |
|---|---|---|---|
| `background` (paper) | `#F6F2E9` | `#10141B` | page |
| `card` (sheet) | `#FBF9F4` | `#171C25` | report sheets, alternating bands |
| `foreground` (charcoal) | `#1E2329` | `#E9E4D8` | body text |
| `primary` (ink navy) | `#1B2A4A` | `#B9C6E0` | headings, primary buttons |
| `muted-foreground` | `#56595E` | `#A9A69E` | secondary text |
| `brass` | `#7A5C24` | `#D2B06A` | § marks, key figures, footnote refs (text-safe) |
| `brass-rule` / `ring` | `#A8874A` | `#8F7440` / `#D2B06A` | thin rules, focus ring |
| `status-covered` | `#2F6246` | `#8CC3A0` | GDPR delta: covered |
| `status-partial` | `#8A5410` | `#E0B066` | GDPR delta: partial |
| `status-new` | `#8E2C2C` | `#E79A8F` | GDPR delta: new |

Verified contrast: body ≥ 14:1, muted ≥ 5.7:1, brass text ≥ 5.5:1, status ≥ 5.6:1, focus ring ≥ 3:1.

## Rules
- Components use semantic tokens only (`text-brass`, `bg-status-new/8`), never raw hex.
- Brass is sparing: rules, focus, § marks, headline figures. It is never used for body text or large fills.
- Status is never conveyed by colour alone. Always use `<DeltaBadge>` (icon + label + sr-only description).
- Type: Source Serif 4 for headings (`font-heading`), IBM Plex Sans for UI and body, IBM Plex Mono for code/IDs. All are self-hosted via `next/font`. Use `tabular-nums` for figures.
- Legal cues: `SectionHeading` (§ n + brass rule), `.para-num` (1.1), `.fn-ref` (footnote superscript), `.marginal-note` ("why this applies"), `.eyebrow`.
- Radius 4px, hairline borders, at most one soft shadow (report sheet). No gradients, stock imagery or legal clichés.
- Touch targets ≥ 44px (buttons `h-10`/`h-11`, nav links `min-h-11`). Visible focus everywhere.
- Motion: 150–250ms colour/opacity transitions only; `prefers-reduced-motion` is honoured globally.
- Layout: container `max-w-6xl`, side padding 16px at 360px. The disclaimer bar and header are **not** sticky, so focus is never obscured.
- Print: `.no-print` hides chrome; external links print their URL.
