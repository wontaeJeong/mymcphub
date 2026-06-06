import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "../components/chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP Hub Operations",
  description: "Control Plane operations console for MCP Hub."
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
