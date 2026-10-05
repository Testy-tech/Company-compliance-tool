import { DEMO_BANNER } from "@/lib/demo";
import { cn } from "cn";

/** Shown on the report and the jurisdiction pages while DEMO_NOTICE is on. */
export function DemoBanner({ className }: { className?: string }) {
  return (
    <p role="note" data-demo-banner className={cn("rounded-lg border-2 border-status-partial/60 bg-status-partial/10 px-4 py-3 text-sm font-medium", className)}>
      {DEMO_BANNER}
    </p>
  );
}
