import { redirect } from "next/navigation";

import { defaultPathForSession } from "../lib/auth/guards";
import { getCurrentSession } from "../lib/auth/session";

export default async function Page() {
  const session = await getCurrentSession();
  redirect(session ? defaultPathForSession(session) : "/login");
}
