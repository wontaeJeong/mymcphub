import Link from "next/link";
import type { ReactNode } from "react";
import type { WebSession } from "../lib/auth/session";
import { NavLink } from "./nav-link";

type NavGroup = Readonly<{
  label: string;
  items: readonly Readonly<{ label: string; href: string }>[];
}>;

const userNavGroups: readonly NavGroup[] = [
  {
    label: "Operate",
    items: [
      { label: "Dashboard", href: "/user" },
      { label: "Servers", href: "/user/catalog" },
    ],
  },
  {
    label: "Govern",
    items: [{ label: "Access Grants", href: "/user/access" }],
  },
  {
    label: "Configure",
    items: [{ label: "Client Setup", href: "/user/client-config" }],
  },
];

const adminNavGroups: readonly NavGroup[] = [
  {
    label: "Operate",
    items: [
      { label: "Dashboard", href: "/admin" },
      { label: "Servers", href: "/admin/servers" },
      { label: "Operations", href: "/admin/operations" },
    ],
  },
  {
    label: "Govern",
    items: [
      { label: "Access Grants", href: "/admin/access" },
      { label: "Approvals", href: "/admin/approvals" },
      { label: "Audit", href: "/admin/audit" },
    ],
  },
  {
    label: "Admin",
    items: [{ label: "Admin / Emergency", href: "/admin/emergency" }],
  },
];

export type AppShellProps = Readonly<{
  children: ReactNode;
  section: "user" | "admin";
  session: WebSession;
}>;

export function AppShell({ children, section, session }: AppShellProps) {
  const navGroups = section === "admin" ? adminNavGroups : userNavGroups;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand__eyebrow">{section === "admin" ? "Admin Plane" : "User Plane"}</p>
          <h1>MCP Hub</h1>
          <p>{section === "admin" ? "Operate servers, govern access, review activity, and keep emergency actions separated from daily work." : "Discover trusted MCP servers, request access, and generate client setup from your workspace."}</p>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          {navGroups.map((group) => (
            <section className="nav__group" aria-label={group.label} key={group.label}>
              <p className="nav__heading">{group.label}</p>
              {group.items.map((item) => (
                <NavLink href={item.href} label={item.label} key={item.href} />
              ))}
            </section>
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
