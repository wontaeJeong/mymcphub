export type AuthenticatedPrincipal = {
  subject: string;
  email?: string;
  teams: string[];
  tokenIssuer: string;
};

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedPrincipal>;
}
