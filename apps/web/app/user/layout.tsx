import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "../../components/chrome";
import { getCurrentSession } from "../../lib/auth/session";

export default async function UserLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  return <AppShell section="user" session={session}>{children}</AppShell>;
}
