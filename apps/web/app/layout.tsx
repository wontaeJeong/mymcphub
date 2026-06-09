import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "../components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = { title: "MCP Hub", description: "조직 MCP 서버 운영 카탈로그" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko" suppressHydrationWarning><body><header className="top"><Link href="/catalog" className="brand">MCP Hub</Link><nav><Link href="/catalog">카탈로그</Link><ThemeToggle /></nav></header><main>{children}</main></body></html>;
}
