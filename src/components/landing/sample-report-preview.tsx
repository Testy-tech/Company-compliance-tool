import { DeltaBadge, type GdprDelta } from "@/components/legal/delta-badge";

/*
 * Illustrative layout only. It shows the report's structure with placeholder
 * content for a fictional "Jurisdiction A"; it makes no claim about any real
 * law. The only concrete citations are to GDPR provisions whose subject
 * matter is used as a label (Art. 30 = records of processing; Chapter V =
 * transfers to third countries).
 */

const stats: { label: string; value: number; delta?: GdprDelta }[] = [
  { label: "Obligations", value: 24 },
  { label: "Covered", value: 9, delta: "covered" },
  { label: "Partial", value: 8, delta: "partial" },
  { label: "New", value: 7, delta: "new" },
];

const items: {
  num: string;
  title: string;
  delta: GdprDelta;
  gdpr: string;
  owner: string;
  fn: number;
}[] = [
  {
    num: "1.1",
    title: "Maintain a record of processing activities",
    delta: "covered",
    gdpr: "Art. 30 GDPR",
    owner: "HQ",
    fn: 1,
  },
  {
    num: "1.2",
    title: "Adopt the local mechanism for outbound transfers",
    delta: "partial",
    gdpr: "Chapter V GDPR",
    owner: "Both",
    fn: 2,
  },
  {
    num: "1.3",
    title: "File the entity's registration with the regulator",
    delta: "new",
    gdpr: "No equivalent",
    owner: "Local entity",
    fn: 3,
  },
];

export function SampleReportPreview() {
  const total = stats[0]!.value;

  return (
    <figure
      aria-labelledby="sample-caption"
      className="relative rounded-md border border-border bg-card shadow-[0_1px_0_0_var(--border),0_12px_32px_-16px_color-mix(in_oklch,var(--primary)_25%,transparent)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <p className="eyebrow">Sample report</p>
        <p className="rounded-sm border border-dashed border-brass-rule px-2 py-0.5 text-[0.6875rem] font-medium text-brass">
          Illustrative layout
        </p>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div>
          <p className="section-mark text-sm">§&thinsp;1</p>
          <p className="font-heading text-xl font-semibold text-primary">
            Jurisdiction A
          </p>
          <p className="text-xs text-muted-foreground">
            Subsidiary · 140 staff · operating
          </p>
        </div>

        <dl className="grid grid-cols-4 gap-2 border-y border-border py-3">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="truncate text-[0.6875rem] text-muted-foreground">
                {s.label}
              </dt>
              <dd
                className={
                  s.delta
                    ? "font-heading text-xl tabular-nums text-foreground"
                    : "font-heading text-xl tabular-nums text-brass"
                }
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>

        <div
          className="flex h-1.5 overflow-hidden rounded-full bg-muted"
          aria-hidden="true"
        >
          {stats.slice(1).map((s) => (
            <span
              key={s.label}
              className={
                s.delta === "covered"
                  ? "bg-status-covered"
                  : s.delta === "partial"
                    ? "bg-status-partial"
                    : "bg-status-new"
              }
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ))}
        </div>

        <ol className="space-y-4">
          {items.map((item) => (
            <li key={item.num} className="grid grid-cols-[2.25rem_1fr] gap-x-2">
              <span className="para-num pt-0.5">{item.num}</span>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                    <sup className="fn-ref ml-0.5">{item.fn}</sup>
                  </p>
                  <DeltaBadge delta={item.delta} />
                </div>
                <p className="text-xs text-muted-foreground">
                  GDPR equivalent: {item.gdpr} · Owner: {item.owner}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="marginal-note">
          Why this applies: the group runs a local subsidiary that processes
          employee data and sends it to headquarters.
        </p>

        <ol className="space-y-0.5 border-t border-border pt-3 text-[0.6875rem] text-muted-foreground">
          {items.map((item) => (
            <li key={item.fn} className="tabular-nums">
              <span className="text-brass">{item.fn}</span> [Official source ·
              pinpoint citation] · last verified [date]
            </li>
          ))}
        </ol>
      </div>

      <figcaption id="sample-caption" className="sr-only">
        Illustrative layout of a DataBorders report for a fictional
        jurisdiction. Placeholder content, not legal findings.
      </figcaption>
    </figure>
  );
}
