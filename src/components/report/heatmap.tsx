import { CircleHelp } from "lucide-react";

import { DeltaBadge, deltaMeta } from "@/components/legal/delta-badge";
import type { Report } from "@/lib/engine/types";
import { obligationCategories } from "@/lib/kb/schema";
import { heatCell } from "@/lib/report/derive";
import { categoryLabels, jurisdictionAnchor, obligationAnchor } from "@/lib/report/labels";
import { cn } from "@/lib/utils";

const tone = {
  covered: "text-status-covered bg-status-covered/8",
  partial: "text-status-partial bg-status-partial/8",
  new: "text-status-new bg-status-new/8",
} as const;

/**
 * Jurisdictions × categories. Each cell shows the number of items and the
 * least-covered status among them as an icon plus a letter, and links to the
 * first of those items. Scrolls sideways inside its own frame on narrow screens.
 */
export function Heatmap({ report }: { report: Report }) {
  const categories = obligationCategories.filter((c) => report.summary.byCategory[c]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {report.gdprBaseline ? (
          <>
            <span>Each cell shows the number of items and the least-covered status among them:</span>
            {(["covered", "partial", "new"] as const).map((d) => (
              <DeltaBadge key={d} delta={d} />
            ))}
          </>
        ) : (
          <span>Each cell shows the number of applicable items.</span>
        )}
        <span className="inline-flex items-center gap-1">
          <CircleHelp aria-hidden="true" className="size-3.5 text-status-partial" /> includes an assumed item
        </span>
      </div>

      <div className="relative mt-4 overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Obligations by jurisdiction and category">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-secondary text-left">
              <th scope="col" className="sticky left-0 z-10 bg-secondary px-3 py-2 font-medium">
                Category
              </th>
              {report.jurisdictions.map((j) => (
                <th key={j.jurisdiction} scope="col" className="px-1 py-2 text-center font-medium">
                  <a href={`#${jurisdictionAnchor(j.jurisdiction)}`} title={j.name} className="underline decoration-brass-rule underline-offset-4">
                    {j.jurisdiction}
                    <span className="sr-only"> ({j.name})</span>
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c} className="border-b last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-normal">
                  {categoryLabels[c]}
                </th>
                {report.jurisdictions.map((j) => {
                  const cell = heatCell(j.results.filter((r) => r.obligation.category === c));
                  if (!cell)
                    return (
                      <td key={j.jurisdiction} className="px-1 py-1 text-center text-muted-foreground">
                        <span aria-hidden="true">·</span>
                        <span className="sr-only">none</span>
                      </td>
                    );
                  const Icon = deltaMeta[cell.worst].icon;
                  return (
                    <td key={j.jurisdiction} className="p-1 text-center">
                      <a
                        href={`#${obligationAnchor(cell.results[0]!.obligation.id)}`}
                        className={cn(
                          "inline-flex h-9 min-w-12 items-center justify-center gap-1 rounded-sm px-1.5 font-medium tabular-nums hover:underline",
                          report.gdprBaseline ? tone[cell.worst] : "bg-secondary text-foreground",
                        )}
                      >
                        {report.gdprBaseline ? <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.25} /> : null}
                        {cell.results.length}
                        {report.gdprBaseline ? <span aria-hidden="true">{deltaMeta[cell.worst].label[0]}</span> : null}
                        {cell.assumed ? <CircleHelp aria-hidden="true" className="size-3 text-status-partial" /> : null}
                        <span className="sr-only">
                          {" "}
                          {cell.results.length === 1 ? "item" : "items"} for {categoryLabels[c]} in {j.name}
                          {report.gdprBaseline ? `, least covered: ${deltaMeta[cell.worst].label}` : ""}
                          {cell.assumed ? `, ${cell.assumed} assumed` : ""}
                        </span>
                      </a>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
