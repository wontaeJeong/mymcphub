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
        <PageHero eyebrow="MCP Hub Sign In" title="Choose your trusted door." description="Only login providers enabled by server-side configuration are shown here." />
        {error ? <div className="error-state"><strong>Sign-in failed</strong><p>{error}</p></div> : null}
        {providers.length === 0 ? <div className="error-state"><strong>No login provider configured</strong><p>Set MCP_WEB_AUTH_ENABLED_PROVIDERS and provider-specific server env vars before exposing this console.</p></div> : null}
        {localProvider ? (
          <form className="form-card" action="/auth/local" method="post">
            <h2>Sign in with username/password</h2>
            <input type="hidden" name="next" value={nextPath} />
            <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" required /></div>
            <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
            <div className="form-actions"><button className="button" type="submit">Sign in</button></div>
          </form>
        ) : null}
        {oidcProviders.length > 0 ? (
          <section className="form-card">
            <h2>Sign in with OIDC</h2>
            <div className="actions">
              {oidcProviders.map((provider) => <a className="button" href={`/auth/oidc/${provider.id}?next=${encodeURIComponent(nextPath)}`} key={provider.id}>Continue with {provider.displayName}</a>)}
            </div>
          </section>
        ) : null}
        {devProvider ? (
          <section className="form-card">
            <h2>Development login</h2>
            <p>Available only outside production and intended for local development.</p>
            <div className="actions">
              <form action="/auth/dev" method="post"><input type="hidden" name="next" value={nextPath} /><input type="hidden" name="role" value="user" /><button className="button button--ghost" type="submit">Continue as dev user</button></form>
              <form action="/auth/dev" method="post"><input type="hidden" name="next" value={nextPath} /><input type="hidden" name="role" value="admin" /><button className="button" type="submit">Continue as dev admin</button></form>
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
      return "The username or password is incorrect.";
    case "rate_limited":
      return "Too many failed attempts. Try again later.";
    case "oidc_state_invalid":
      return "OIDC state validation failed. Start sign-in again.";
    case "oidc_callback_failed":
      return "The OIDC provider callback could not be validated.";
    case "provider_unavailable":
      return "That login provider is not enabled.";
    case "local_disabled":
    case "dev_disabled":
      return "That login method is disabled.";
    default:
      return undefined;
  }
}
