import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "./theme-toggle";

const navItems = [
  ["대시보드", "/"],
  ["서버 카탈로그", "/catalog"],
  ["도구 탐색", "/tools"],
  ["접근 권한", "/access"],
  ["승인 대기열", "/approvals"],
  ["감사 로그", "/audit"],
  ["운영 상태", "/operations"],
  ["클라이언트 설정", "/client-config"],
  ["긴급 제어", "/admin"]
] as const;

export type AppShellProps = Readonly<{
  children: ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand__eyebrow">제어 플레인</p>
          <h1>MCP Hub</h1>
          <p>서버, 도구, 권한, 승인, 장애 대응을 한 곳에서 운영합니다.</p>
        </div>
        <ThemeToggle />
        <nav className="nav" aria-label="주요 탐색">
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
