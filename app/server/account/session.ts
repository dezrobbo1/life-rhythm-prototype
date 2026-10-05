import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';
export type SessionVerificationConfig = {
  issuer: string;
  origins: string[];
  jwks: JSONWebKeySet;
};
export type VerifiedAccount = Readonly<{
  issuer: string;
  subject: string;
  sessionId: string;
}>;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Only approved public keys; no issuer-derived fetch or privileged Auth/API credential. */
export async function verifySession(
  bearer: string,
  config: SessionVerificationConfig,
): Promise<VerifiedAccount> {
  if (
    bearer.length > 8192 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer)
  )
    throw new Error('unauthorized');
  const { payload: claims, protectedHeader } = await jwtVerify(
    bearer,
    createLocalJWKSet(config.jwks),
    {
      issuer: config.issuer,
      audience: 'authenticated',
      algorithms: ['ES256', 'RS256'],
      requiredClaims: [
        'iss',
        'sub',
        'aud',
        'exp',
        'iat',
        'role',
        'session_id',
        'is_anonymous',
        'aal',
      ],
      clockTolerance: 0,
    },
  );
  const aud = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
  const now = Math.floor(Date.now() / 1000);
  if (
    protectedHeader.typ !== 'JWT' ||
    typeof protectedHeader.kid !== 'string' ||
    !protectedHeader.kid ||
    !Array.isArray(aud) ||
    !aud.length ||
    !aud.every((v) => typeof v === 'string' && v.length > 0) ||
    !aud.includes('authenticated') ||
    claims.role !== 'authenticated' ||
    !uuid.test(claims.sub ?? '') ||
    typeof claims.session_id !== 'string' ||
    !uuid.test(claims.session_id) ||
    claims.is_anonymous !== false ||
    (claims.aal !== 'aal1' && claims.aal !== 'aal2') ||
    'client_id' in claims ||
    'ref' in claims ||
    'token_type' in claims ||
    !Number.isInteger(claims.exp) ||
    !Number.isInteger(claims.iat) ||
    (claims.iat as number) > now ||
    (claims.exp as number) <= (claims.iat as number) ||
    (claims.nbf !== undefined && !Number.isInteger(claims.nbf))
  )
    throw new Error('unauthorized');
  return Object.freeze({
    issuer: config.issuer,
    subject: claims.sub!,
    sessionId: claims.session_id,
  });
}
