import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "MCP Hub", description: "내부 MCP 서버 카탈로그" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body><header className="top"><Link href="/catalog" className="brand">MCP Hub</Link><nav><Link href="/catalog">Catalog</Link></nav></header><main>{children}</main></body></html>;
}
