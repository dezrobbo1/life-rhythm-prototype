import { verifyToken } from '@clerk/backend';
export type SessionVerificationConfig = {
  issuer: string;
  origins: string[];
  publicKey: string;
  publicKeyId: string;
  audience?: string;
};
export type VerifiedAccount = Readonly<{ issuer: string; subject: string; sessionId: string }>;
/** Networkless public-key SDK path: no backend secret and no key derived from untrusted JWT issuer. */
export async function verifySession(
  bearer: string,
  config: SessionVerificationConfig,
): Promise<VerifiedAccount> {
  if (bearer.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer))
    throw new Error('unauthorized');
  const header = JSON.parse(Buffer.from(bearer.split('.')[0], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || header.typ !== 'JWT' || header.kid !== config.publicKeyId)
    throw new Error('unauthorized');
  const claims = await verifyToken(bearer, {
    jwtKey: config.publicKey,
    authorizedParties: config.origins,
    ...(config.audience ? { audience: config.audience } : {}),
    clockSkewInMs: 0,
    headerType: 'JWT',
  });
  // verifyToken is the SDK signature/time verifier; the wrapper restricts it to Clerk sessions.
  if (
    !claims ||
    claims.role !== 'authenticated' ||
    claims.iss !== config.issuer ||
    !/^user_[A-Za-z0-9_-]{1,200}$/.test(claims.sub ?? '') ||
    !/^sess_[A-Za-z0-9_-]{1,200}$/.test(claims.sid ?? '') ||
    !config.origins.includes(claims.azp ?? '') ||
    ('token_type' in claims && claims.token_type !== 'session_token') ||
    !Number.isInteger(claims.exp) ||
    !Number.isInteger(claims.nbf) ||
    !Number.isInteger(claims.iat)
  )
    throw new Error('unauthorized');
  return Object.freeze({ issuer: claims.iss, subject: claims.sub, sessionId: claims.sid });
}
