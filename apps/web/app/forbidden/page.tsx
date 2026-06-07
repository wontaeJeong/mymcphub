import Link from "next/link";

import { ForbiddenPanel } from "../../components/chrome";

export default function ForbiddenPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <ForbiddenPanel />
        <div className="actions">
          <Link className="button" href="/user">Open user area</Link>
          <form action="/auth/logout" method="post"><button className="button button--ghost" type="submit">Sign out</button></form>
        </div>
      </div>
    </main>
  );
}
