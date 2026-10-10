import { createPublicKey } from 'node:crypto';
import type { JSONWebKeySet } from 'jose';
import { z } from 'zod';
import type { SessionVerificationConfig } from './session.js';
export type ServerConfig = SessionVerificationConfig & {
  supabaseUrl: string;
  publishableKey: string;
  buildId: string;
};
const string = z.string().min(1).max(8192);
function exactOrigin(value: string) {
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    url.protocol !== 'https:'
  )
    throw new Error('unavailable');
  return value;
}
export function readServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const origins = string.parse(env.LIFE_RHYTHM_ALLOWED_ORIGINS).split(',');
  if (origins.length > 8 || new Set(origins).size !== origins.length)
    throw new Error('unavailable');
  origins.forEach((value) => {
    if (
      (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
      /^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/.test(value)
    )
      return;
    exactOrigin(value);
  });
  const previewOptIn = env.LIFE_RHYTHM_ALLOW_VERCEL_PREVIEW_SELF_ORIGIN;
  if (
    previewOptIn !== undefined &&
    previewOptIn !== "false" &&
    previewOptIn !== "true"
  )
    throw new Error("unavailable");
  if (previewOptIn === "true") {
    // Platform settings are operator-controlled, never request headers. Default off.
    const host = env.VERCEL_URL;
    if (
      env.VERCEL !== "1" ||
      env.VERCEL_ENV !== "preview" ||
      env.VERCEL_PROJECT_ID !== "prj_Os5Ucic7cDQwut3mO3I39V3lc52s" ||
      typeof host !== "string" ||
      host.length > 253 ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(host) ||
      host.includes("-git-") ||
      host === "life-rhythm-prototype.vercel.app"
    )
      throw new Error("unavailable");
    const self = exactOrigin("https://" + host);
    if (!origins.includes(self)) origins.push(self);
    if (origins.length > 8) throw new Error("unavailable");
  }
  const supabaseUrl = exactOrigin(string.parse(env.SUPABASE_URL));
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl))
    throw new Error('unavailable');
  const publishableKey = z
    .string()
    .regex(/^sb_publishable_[A-Za-z0-9_-]{1,256}$/)
    .parse(env.SUPABASE_PUBLISHABLE_KEY);
  const buildId = z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,128}$/)
    .parse(env.LIFE_RHYTHM_BUILD_ID ?? env.VERCEL_GIT_COMMIT_SHA);
  const issuer = supabaseUrl + '/auth/v1';
  const parsed: unknown = JSON.parse(string.parse(env.SUPABASE_AUTH_JWKS));
  const jwks = z
    .object({
      keys: z
        .array(
          z
            .object({
              kty: z.enum(['RSA', 'EC']),
              kid: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
              alg: z.enum(['RS256', 'ES256']),
              use: z.literal('sig').optional(),
              key_ops: z.array(z.literal('verify')).max(1).optional(),
              n: string.optional(),
              e: string.optional(),
              crv: z.literal('P-256').optional(),
              x: string.optional(),
              y: string.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(4),
    })
    .strict()
    .parse(parsed) as JSONWebKeySet;
  if (new Set(jwks.keys.map((k) => k.kid)).size !== jwks.keys.length)
    throw new Error('unavailable');
  for (const jwk of jwks.keys) {
    if ((jwk.kty === 'RSA') !== (jwk.alg === 'RS256'))
      throw new Error('unavailable');
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    if (
      jwk.kty === 'RSA' &&
      (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
    )
      throw new Error('unavailable');
    if (
      jwk.kty === 'EC' &&
      key.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
    )
      throw new Error('unavailable');
  }
  return { issuer, origins, jwks, supabaseUrl, publishableKey, buildId };
}
