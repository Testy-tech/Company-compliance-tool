import Link from "next/link";

/**
 * Persistent, non-sticky notice shown on every page. Deliberately not fixed
 * so it never obscures keyboard focus (WCAG 2.2, 2.4.11).
 */
export function DisclaimerBar() {
  return (
    <aside
      aria-label="Disclaimer"
      className="border-b border-border bg-muted text-muted-foreground"
    >
      <p className="mx-auto max-w-6xl px-4 py-2 text-xs leading-relaxed sm:px-6 lg:px-8">
        <strong className="font-medium text-foreground">
          Informational tool, not legal advice.
        </strong>{" "}
        Verify every finding with qualified counsel in each jurisdiction.{" "}
        <Link
          href="/legal#disclaimer"
          className="underline decoration-brass-rule underline-offset-2 hover:text-foreground"
        >
          Read the disclaimer
        </Link>
      </p>
    </aside>
  );
}
