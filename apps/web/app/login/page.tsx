import { redirect } from "next/navigation";

import { PageHero } from "../../components/chrome";
import { ShieldIcon, UserIcon } from "../../components/icons";
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
        <PageHero eyebrow="MCP Hub" title="MCP Hub에 로그인" description="조직 계정 또는 허용된 로그인 방식으로 계속하세요." />
        {error ? <div className="error-state"><strong>로그인 실패</strong><p>{error}</p></div> : null}
        {providers.length === 0 ? <div className="error-state"><strong>로그인할 수 없습니다</strong><p>사용 가능한 로그인 방식이 없습니다. 관리자에게 문의하세요.</p></div> : null}
        {localProvider ? (
          <form className="form-card" action="/auth/local" method="post">
            <h2>계정으로 로그인</h2>
            <input type="hidden" name="next" value={nextPath} />
            <div className="field"><label htmlFor="username">사용자 이름</label><input id="username" name="username" autoComplete="username" required /></div>
            <div className="field"><label htmlFor="password">비밀번호</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
            <div className="form-actions"><button className="button" type="submit"><UserIcon />로그인</button></div>
          </form>
        ) : null}
        {oidcProviders.length > 0 ? (
          <section className="form-card">
            <h2>조직 계정</h2>
            <div className="actions">
              {oidcProviders.map((provider) => <a className="button" href={`/auth/oidc/${provider.id}?next=${encodeURIComponent(nextPath)}`} key={provider.id}><ShieldIcon />{provider.displayName}로 계속</a>)}
            </div>
          </section>
        ) : null}
        {devProvider ? (
          <section className="form-card">
            <h2>개발 로그인</h2>
            <p>개발 환경에서 화면을 확인할 때만 사용합니다.</p>
            <div className="actions">
              <form action="/auth/dev" method="post"><input type="hidden" name="next" value={nextPath} /><input type="hidden" name="role" value="user" /><button className="button button--ghost" type="submit"><UserIcon />개발 사용자로 계속</button></form>
              <form action="/auth/dev" method="post"><input type="hidden" name="next" value={nextPath} /><input type="hidden" name="role" value="admin" /><button className="button" type="submit"><ShieldIcon />개발 관리자로 계속</button></form>
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
      return "사용자 이름 또는 비밀번호가 올바르지 않습니다. 다시 입력하세요.";
    case "rate_limited":
      return "실패한 시도가 너무 많습니다. 잠시 후 다시 시도하세요.";
    case "oidc_state_invalid":
      return "로그인 요청 확인에 실패했습니다. 처음부터 다시 시도하세요.";
    case "oidc_callback_failed":
      return "조직 계정 확인에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.";
    case "provider_unavailable":
      return "선택한 로그인 방식은 현재 사용할 수 없습니다. 다른 방식으로 시도하세요.";
    case "local_disabled":
    case "dev_disabled":
      return "해당 로그인 방식이 비활성화되어 있습니다. 관리자에게 문의하세요.";
    default:
      return undefined;
  }
}
