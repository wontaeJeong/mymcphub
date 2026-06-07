import { signJson, verifySignedJson } from "./session";

export type OidcTransaction = Readonly<{
  providerId: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  nextPath: string;
  expiresAt: number;
}>;

export function transactionCookieName(providerId: string) {
  return `mcp_oidc_${providerId}_tx`;
}

export function createTransactionToken(transaction: OidcTransaction) {
  return signJson(transaction);
}

export function verifyTransactionToken(token: string | undefined, expectedState: string, now = Math.floor(Date.now() / 1000)) {
  const transaction = verifySignedJson<OidcTransaction>(token);
  if (!transaction || transaction.state !== expectedState || transaction.expiresAt <= now) {
    return undefined;
  }
  return transaction;
}
