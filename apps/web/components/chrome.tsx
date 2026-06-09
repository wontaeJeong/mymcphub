"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { WebSession } from "../lib/auth/session";

import { ThemeToggle } from "./theme-toggle";

const userNavItems = [
  ["사용자 홈", "/user"],
  ["MCP Market", "/user/catalog"],
  ["접근 권한", "/user/access"],
  ["클라이언트 설정", "/user/client-config"]
] as const;

const adminNavItems = [
  ["운영 현황", "/admin"],
  ["카탈로그 관리", "/admin/servers"],
  ["승인 요청", "/admin/approvals"],
  ["감사 로그", "/admin/audit"],
  ["운영 상태", "/admin/operations"],
  ["긴급 조치", "/admin/emergency"]
] as const;

export type AppShellProps = Readonly<{
  children: ReactNode;
  section: "user" | "admin";
  session: WebSession;
}>;

export function AppShell({ children, section, session }: AppShellProps) {
  const pathname = usePathname();
  const navItems = section === "admin" ? adminNavItems : userNavItems;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand__eyebrow">{section === "admin" ? "Admin Console" : "MCP Market"}</p>
          <h1>MCP Hub</h1>
          <p>{section === "admin" ? "서버, 권한, 운영 상태를 관리합니다." : "필요한 MCP 서버를 찾고 연결합니다."}</p>
        </div>
        <ThemeToggle />
        <nav className="nav" aria-label="주요 탐색">
          {navItems.map(([label, href]) => {
            const isActive = pathname === href || (href !== `/${section}` && pathname.startsWith(`${href}/`));
            return (
            <Link aria-current={isActive ? "page" : undefined} href={href} key={href}>
              {label}
            </Link>
            );
          })}
        </nav>
        <div className="session-card">
          <p className="brand__eyebrow">로그인됨</p>
          <strong>{session.principal.displayName}</strong>
          <p>{session.principal.isPlatformAdmin ? "관리자 세션" : "사용자 세션"}</p>
          <details className="schema-viewer">
            <summary>계정 세부정보 보기</summary>
            <p>{session.principal.email}</p>
          </details>
          {session.principal.isPlatformAdmin ? <Link className="button button--ghost" href="/admin">관리자 영역</Link> : null}
          <form action="/auth/logout" method="post">
            <button className="button button--ghost" type="submit">로그아웃</button>
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
      <h1>관리자 권한이 필요합니다.</h1>
      <p>이 화면은 플랫폼 관리자만 접근할 수 있습니다.</p>
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
