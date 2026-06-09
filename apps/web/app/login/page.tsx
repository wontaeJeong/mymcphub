import { redirect } from "next/navigation";

import { PageHero } from "../../components/chrome";
import { getPublicLoginProviders } from "../../lib/auth/config";
import { defaultPathForSession } from "../../lib/auth/guards";
import { getCurrentSession } from "../../lib/auth/session";
import { sanitizeRedirectPath } from "../../lib/auth/oidc";

type LoginPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getCurrentSession();
  if (session) {
    redirect(defaultPathForSession(session));
  }
  const params = await searchParams;
  const nextPath = sanitizeRedirectPath(readParam(params.next));
  const providers = getPublicLoginProviders();
  const localProvider = providers.find((provider) => provider.kind === "local");
  const oidcProviders = providers.filter((provider) => provider.kind === "oidc");
  const devProvider = providers.find((provider) => provider.kind === "dev");
  const error = loginErrorMessage(readParam(params.error));

  return (
    <main className="auth-page">
      <div className="auth-card">
        <PageHero eyebrow="MCP Hub 로그인" title="허용된 로그인 방식을 선택하세요." description="조직에서 사용할 수 있도록 준비한 로그인 방식만 표시됩니다." />
        {error ? <div className="error-state"><strong>로그인 실패</strong><p>{error}</p></div> : null}
        {providers.length === 0 ? <div className="error-state"><strong>로그인 방식 준비 안 됨</strong><p>관리자에게 MCP Hub 로그인 설정 확인을 요청하세요.</p></div> : null}
        {localProvider ? (
          <form className="form-card" action="/auth/local" method="post">
            <h2>사용자 이름과 비밀번호로 로그인</h2>
            <input type="hidden" name="next" value={nextPath} />
            <div className="field"><label htmlFor="username">사용자 이름</label><input id="username" name="username" autoComplete="username" required /></div>
            <div className="field"><label htmlFor="password">비밀번호</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
            <div className="form-actions"><button className="button" type="submit">로그인</button></div>
          </form>
        ) : null}
        {oidcProviders.length > 0 ? (
          <section className="form-card">
            <h2>조직 계정으로 로그인</h2>
            <div className="actions">
              {oidcProviders.map((provider) => <a className="button" href={`/auth/oidc/${provider.id}?next=${encodeURIComponent(nextPath)}`} key={provider.id}>{provider.displayName}로 계속</a>)}
            </div>
          </section>
        ) : null}
        {devProvider ? (
          <section className="form-card">
            <h2>로컬 점검용 로그인</h2>
            <p>개발 환경에서 화면과 권한 흐름을 확인할 때만 사용합니다.</p>
            <div className="actions">
              <form action="/auth/dev" method="post"><input type="hidden" name="next" value={nextPath} /><input type="hidden" name="role" value="user" /><button className="button button--ghost" type="submit">개발 사용자로 계속</button></form>
              <form action="/auth/dev" method="post"><input type="hidden" name="next" value={nextPath} /><input type="hidden" name="role" value="admin" /><button className="button" type="submit">개발 관리자로 계속</button></form>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function loginErrorMessage(error: string | undefined) {
  switch (error) {
    case "invalid_credentials":
      return "사용자 이름 또는 비밀번호가 올바르지 않습니다.";
    case "rate_limited":
      return "실패한 시도가 너무 많습니다. 나중에 다시 시도하세요.";
    case "oidc_state_invalid":
      return "로그인 요청 확인에 실패했습니다. 처음부터 다시 시도하세요.";
    case "oidc_callback_failed":
      return "조직 계정 확인에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.";
    case "provider_unavailable":
      return "선택한 로그인 방식은 현재 사용할 수 없습니다.";
    case "local_disabled":
    case "dev_disabled":
      return "해당 로그인 방식이 비활성화되어 있습니다.";
    default:
      return undefined;
  }
}
