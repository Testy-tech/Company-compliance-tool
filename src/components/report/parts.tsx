import { CircleHelp } from "lucide-react";

import type { ObligationResult } from "@/lib/engine/types";
import { obligationAnchor } from "@/lib/report/labels";
import { cn } from "@/lib/utils";

/* Small pieces shared by the report sections. */

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-sm border px-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground", className)}>
      {children}
    </span>
  );
}

/** "Assumption" marker: icon and text, never colour alone. */
export function AssumptionBadge({ className }: { className?: string }) {
  return (
    <Tag className={cn("border-status-partial/40 bg-status-partial/8 text-status-partial", className)}>
      <CircleHelp aria-hidden="true" className="size-3.5" />
      Assumption
    </Tag>
  );
}

/** Link to an obligation's paragraph, e.g. "§ 2.4 Sign and file the CAC standard contract". */
export function ItemLink({ result, showTitle = true }: { result: ObligationResult; showTitle?: boolean }) {
  return (
    <a href={`#${obligationAnchor(result.obligation.id)}`} className="underline decoration-brass-rule underline-offset-4 hover:text-primary">
      <span className="tabular-nums">§&nbsp;{result.paragraph}</span>
      {showTitle ? <> {result.obligation.title}</> : null}
    </a>
  );
}

/** A key figure in the executive summary. */
export function Stat({ value, label, note }: { value: React.ReactNode; label: string; note?: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <dt className="mt-1 text-sm font-medium">{label}</dt>
      <dd className="order-first font-heading text-3xl font-semibold text-primary tabular-nums">{value}</dd>
      {note ? <dd className="mt-1 text-xs text-muted-foreground">{note}</dd> : null}
    </div>
  );
}

/** Report section heading: "§ 3  Germany" or "A  Transfer map". */
export function ReportHeading({ id, mark, children, eyebrow }: { id: string; mark: string; children: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="space-y-3">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 id={id} tabIndex={-1} className="flex items-baseline gap-3 text-2xl font-semibold text-primary outline-none sm:text-3xl">
        <span className="section-mark text-xl sm:text-2xl" aria-hidden="true">
          {mark}
        </span>
        <span>{children}</span>
      </h2>
      <hr className="rule-brass w-16" />
    </div>
  );
}
