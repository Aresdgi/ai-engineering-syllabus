"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavLinkProps = {
  href: string;
  label: string;
};

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <a
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-block rounded-md px-2.5 py-1 text-sm transition-colors duration-150 ease-out sm:py-1.5",
        isActive
          ? "bg-foreground font-medium text-background"
          : "text-muted-foreground hover-fine:bg-muted/60 hover-fine:text-foreground",
      )}
    >
      {label}
    </a>
  );
}
