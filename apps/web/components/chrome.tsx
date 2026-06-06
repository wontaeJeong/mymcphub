import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  ["Dashboard", "/"],
  ["Catalog", "/catalog"],
  ["Tool Explorer", "/tools"],
  ["Access", "/access"],
  ["Approvals", "/approvals"],
  ["Audit", "/audit"],
  ["Operations", "/operations"],
  ["Client Config", "/client-config"],
  ["Emergency", "/admin"]
] as const;

export type AppShellProps = Readonly<{
  children: ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand__eyebrow">Control Plane</p>
          <h1>MCP Hub</h1>
          <p>Govern every server, tool, grant, approval, and incident circuit from one operations console.</p>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          {navItems.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export type PageHeroProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
}>;

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <header className="page-hero">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

export type SectionHeaderProps = Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}>;

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
