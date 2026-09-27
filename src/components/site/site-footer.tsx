import Link from "next/link";

import { footerNav, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="no-print mt-auto border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div className="max-w-prose space-y-3">
          <p className="font-heading text-base font-semibold text-primary">
            <span aria-hidden="true" className="mr-1.5 text-brass">
              §
            </span>
            {site.name}
          </p>
          <p className="text-sm text-muted-foreground">
            An informational tool. It does not constitute legal advice and
            does not create a client relationship. Obligations are drawn from a
            versioned knowledge base; each one cites its official source and
            shows when it was last verified.
          </p>
          <p className="text-xs text-muted-foreground">
            Knowledge base: not yet populated. Review dates will appear here
            once the jurisdiction files are published.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-col gap-1 text-sm md:items-end">
            {footerNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline md:min-h-8"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
