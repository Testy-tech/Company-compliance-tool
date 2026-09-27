import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Temporary page body for routes that are built in a later phase. */
export function PlaceholderPage({
  title,
  summary,
  phase,
}: {
  title: string;
  summary: string;
  phase: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <p className="eyebrow">In preparation · {phase}</p>
      <h1 className="mt-3 text-3xl font-semibold text-primary sm:text-4xl">
        {title}
      </h1>
      <hr className="rule-brass mt-5 w-16" />
      <p className="mt-6 max-w-prose text-lg text-muted-foreground">{summary}</p>
      <Button asChild variant="outline" className="mt-8">
        <Link href="/">Back to the overview</Link>
      </Button>
    </div>
  );
}
