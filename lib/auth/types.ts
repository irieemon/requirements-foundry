/**
 * User information extracted from Cognito ID token claims.
 * Stored in the session cookie (not the raw JWT).
 */
export interface UserInfo {
  sub: string;
  email: string;
  name: string;
  groups: string[];
}

/**
 * Session data stored in the encrypted iron-session cookie.
 * Does NOT store the full ID token to avoid cookie size limits (~4KB).
 * Stores only extracted claims + refresh token.
 */
export interface SessionData {
  refreshToken: string;
  expiresAt: number; // Unix timestamp (seconds)
  user: UserInfo;
}
