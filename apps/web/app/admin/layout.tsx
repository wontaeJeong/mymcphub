import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell, ForbiddenPanel } from "../../components/chrome";
import { getCurrentSession } from "../../lib/auth/session";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.principal.isPlatformAdmin) {
    return <AppShell section="user" session={session}><ForbiddenPanel /></AppShell>;
  }
  return <AppShell section="admin" session={session}>{children}</AppShell>;
}
