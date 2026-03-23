/**
 * Cognito OAuth2 URL builders and token exchange functions.
 *
 * Uses environment variables provided by ECS container (from Phase 26 CDK):
 * - COGNITO_DOMAIN: e.g., {prefix}.auth.{region}.amazoncognito.com
 * - COGNITO_CLIENT_ID: Cognito app client ID
 * - COGNITO_REDIRECT_URI: e.g., https://app.example.com/api/auth/callback
 * - COGNITO_CLIENT_SECRET: Cognito app client secret (from Secrets Manager)
 */

/** Strip protocol prefix from COGNITO_DOMAIN if present (handles both with/without https://) */
function cognitoDomain(): string {
  return (cognitoDomain() || "").replace(/^https?:\/\//, "");
}

/**
 * Build the Cognito authorize URL.
 * Goes to Cognito Hosted UI which shows available sign-in options
 * (email/password and Okta when SAML is configured).
 *
 * @param returnTo - Optional path to redirect to after login (encoded in state param)
 * @returns Full authorize URL string
 */
export function buildAuthorizeUrl(returnTo?: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.COGNITO_CLIENT_ID!,
    redirect_uri: process.env.COGNITO_REDIRECT_URI!,
    scope: "openid profile email",
    state: returnTo || "/",
  });
  return `https://${cognitoDomain()}/oauth2/authorize?${params}`;
}

/**
 * Build the Cognito logout URL.
 * Clears Cognito session only (does NOT end Okta session per user decision).
 *
 * @returns Full logout URL string
 */
export function buildLogoutUrl(): string {
  // Derive app root URL from COGNITO_REDIRECT_URI by stripping the callback path
  const redirectUri = process.env.COGNITO_REDIRECT_URI!;
  const appRoot = new URL("/", redirectUri).toString();

  const params = new URLSearchParams({
    client_id: process.env.COGNITO_CLIENT_ID!,
    logout_uri: appRoot,
  });
  return `https://${cognitoDomain()}/logout?${params}`;
}

/**
 * Exchange an authorization code for tokens via Cognito token endpoint.
 *
 * @param code - Authorization code from callback
 * @returns Token response with id_token, access_token, refresh_token, expires_in
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<{
  id_token: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.COGNITO_REDIRECT_URI!,
    client_id: process.env.COGNITO_CLIENT_ID!,
    client_secret: process.env.COGNITO_CLIENT_SECRET!,
  });

  const response = await fetch(
    `https://${cognitoDomain()}/oauth2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  return response.json();
}

/**
 * Refresh tokens using a refresh token via Cognito token endpoint.
 * Used for silent re-auth when the ID token is near expiry.
 *
 * @param refreshToken - The refresh token from the session
 * @returns Token response with new id_token, access_token, expires_in (no new refresh_token)
 */
export async function refreshTokens(
  refreshToken: string
): Promise<{
  id_token: string;
  access_token: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.COGNITO_CLIENT_ID!,
    client_secret: process.env.COGNITO_CLIENT_SECRET!,
  });

  const response = await fetch(
    `https://${cognitoDomain()}/oauth2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  return response.json();
}
