"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  className,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-sm px-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground",
        "aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-brass-rule aria-[current=page]:decoration-1 aria-[current=page]:underline-offset-[6px]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
