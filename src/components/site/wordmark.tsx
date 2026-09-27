import Link from "next/link";

import { site } from "@/lib/site";

export function Wordmark() {
  return (
    <Link
      href="/"
      className="group inline-flex min-h-11 items-center gap-2 rounded-sm"
      aria-label={`${site.name}, home`}
    >
      <span
        aria-hidden="true"
        className="font-heading text-2xl leading-none text-brass"
      >
        §
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight text-primary">
        {site.name}
      </span>
    </Link>
  );
}
