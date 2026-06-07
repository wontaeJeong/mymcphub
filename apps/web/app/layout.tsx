import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "MCP Hub 운영 콘솔",
  description: "MCP Hub 제어 플레인 운영 콘솔입니다."
};

const themeScript = `
try {
  var stored = window.localStorage.getItem("mcp-hub-theme");
  var theme = stored === "light" || stored === "dark" ? stored : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
} catch (_) {
  document.documentElement.dataset.theme = "dark";
}
`;

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
