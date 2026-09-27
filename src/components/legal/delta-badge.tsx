import { Check, CircleDashed, Plus, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type GdprDelta = "covered" | "partial" | "new";

const deltaMeta: Record<
  GdprDelta,
  { label: string; description: string; icon: LucideIcon; className: string }
> = {
  covered: {
    label: "Covered",
    description: "Already met by the GDPR programme",
    icon: Check,
    className: "text-status-covered border-status-covered/40 bg-status-covered/8",
  },
  partial: {
    label: "Partial",
    description: "GDPR programme covers part; local additions needed",
    icon: CircleDashed,
    className: "text-status-partial border-status-partial/40 bg-status-partial/8",
  },
  new: {
    label: "New",
    description: "No GDPR equivalent; new work required",
    icon: Plus,
    className: "text-status-new border-status-new/40 bg-status-new/8",
  },
};

export function DeltaBadge({
  delta,
  className,
}: {
  delta: GdprDelta;
  className?: string;
}) {
  const { label, description, icon: Icon, className: tone } = deltaMeta[delta];
  return (
    <span
      title={description}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-sm border px-1.5 text-xs font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" strokeWidth={2.25} />
      <span>
        {label}
        <span className="sr-only"> relative to GDPR: {description}</span>
      </span>
    </span>
  );
}

export { deltaMeta };
