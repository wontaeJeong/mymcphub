import Link from "next/link";

import { ForbiddenPanel } from "../../components/chrome";

export default function ForbiddenPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <ForbiddenPanel />
        <div className="actions">
          <Link className="button" href="/user">사용자 영역 열기</Link>
          <form action="/auth/logout" method="post"><button className="button button--ghost" type="submit">로그아웃</button></form>
        </div>
      </div>
    </main>
  );
}
