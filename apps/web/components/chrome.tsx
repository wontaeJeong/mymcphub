import Link from "next/link";
import type { ReactNode } from "react";
import type { WebSession } from "../lib/auth/session";

const userNavItems = [
  ["User Home", "/user"],
  ["Catalog", "/user/catalog"],
  ["Access", "/user/access"],
  ["Client Config", "/user/client-config"]
] as const;

const adminNavItems = [
  ["Admin Home", "/admin"],
  ["Servers", "/admin/servers"],
  ["Approvals", "/admin/approvals"],
  ["Audit", "/admin/audit"],
  ["Operations", "/admin/operations"],
  ["Emergency", "/admin/emergency"]
] as const;

export type AppShellProps = Readonly<{
  children: ReactNode;
  section: "user" | "admin";
  session: WebSession;
}>;

export function AppShell({ children, section, session }: AppShellProps) {
  const navItems = section === "admin" ? adminNavItems : userNavItems;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand__eyebrow">{section === "admin" ? "Admin Plane" : "User Plane"}</p>
          <h1>MCP Hub</h1>
          <p>{section === "admin" ? "Approve access, audit activity, operate servers, and control incidents from the protected admin console." : "Discover MCP servers, request access, and generate client configuration from your user workspace."}</p>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          {navItems.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="session-card">
          <p className="brand__eyebrow">Signed in</p>
          <strong>{session.principal.displayName}</strong>
          <p>{session.principal.email}</p>
          {session.principal.isPlatformAdmin ? <Link className="button button--ghost" href="/admin">Admin area</Link> : null}
          <form action="/auth/logout" method="post">
            <button className="button button--ghost" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export function ForbiddenPanel() {
  return (
    <div className="error-state">
      <p className="eyebrow">403</p>
      <h1>Permission required.</h1>
      <p>This page requires the platform admin role or a configured admin group mapping. Your current session is authenticated but not authorized for this admin surface.</p>
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
