"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A link that marks itself current. `exact` for "/", prefix match otherwise. */
export function NavLink({ href, className = "nav-link", exact = false, children }: { href: string; className?: string; exact?: boolean; children: ReactNode }) {
  const path = usePathname() ?? "";
  const current = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return <a href={href} className={className} aria-current={current ? "page" : undefined}>{children}</a>;
}
