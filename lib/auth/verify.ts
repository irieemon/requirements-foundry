import "server-only";
import { CognitoJwtVerifier } from "aws-jwt-verify";

/**
 * Singleton Cognito JWT verifier.
 * JWKS keys are cached automatically by aws-jwt-verify.
 */
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: "id",
  clientId: process.env.COGNITO_CLIENT_ID!,
});

/**
 * Verify a Cognito ID token.
 * Validates signature (via cached JWKS), expiry, issuer, audience, and token_use.
 *
 * @param token - The raw JWT string from the ID token
 * @returns Verified token payload with claims
 * @throws If token is invalid, expired, or has wrong claims
 */
export async function verifyIdToken(token: string) {
  return verifier.verify(token);
}
