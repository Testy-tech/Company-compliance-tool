"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";

import { NavLink } from "@/components/site/nav-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { mainNav, site } from "@/lib/site";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,85vw)]">
        <SheetHeader>
          <SheetTitle className="font-heading">{site.name}</SheetTitle>
          <SheetDescription>{site.tagline}</SheetDescription>
        </SheetHeader>
        <nav aria-label="Main" className="px-4">
          <ul className="flex flex-col">
            {mainNav.map((item) => (
              <li key={item.href} className="border-b border-border">
                <NavLink
                  href={item.href}
                  onNavigate={close}
                  className="w-full px-0 text-base"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link href="/assess" onClick={close}>
              Start assessment
            </Link>
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
