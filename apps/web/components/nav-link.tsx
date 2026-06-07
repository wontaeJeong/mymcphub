"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: Readonly<{ href: string; label: string }>) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/admin" && href !== "/user" && pathname.startsWith(`${href}/`));

  return (
    <Link className="nav__link" href={href} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  );
}
