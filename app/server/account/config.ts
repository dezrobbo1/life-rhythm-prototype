import { createPublicKey } from 'node:crypto';
import { z } from 'zod';
import type { SessionVerificationConfig } from './session';
export type ServerConfig = SessionVerificationConfig & {
  supabaseUrl: string;
  publishableKey: string;
  buildId: string;
};
const string = z.string().min(1).max(8192);
function exactOrigin(value: string) {
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password || url.protocol !== 'https:')
    throw new Error('unavailable');
  return value;
}
export function readServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const issuer = exactOrigin(string.parse(env.CLERK_ISSUER));
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
  const publicKey = string.parse(env.CLERK_JWT_PUBLIC_KEY);
  const publicKeyId = z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,128}$/)
    .parse(env.CLERK_JWT_KEY_ID);
  const key = createPublicKey(publicKey);
  if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
    throw new Error('unavailable');
  const supabaseUrl = exactOrigin(string.parse(env.SUPABASE_URL));
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) throw new Error('unavailable');
  const publishableKey = z
    .string()
    .regex(/^sb_publishable_[A-Za-z0-9_-]{1,256}$/)
    .parse(env.SUPABASE_PUBLISHABLE_KEY);
  const buildId = z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,128}$/)
    .parse(env.LIFE_RHYTHM_BUILD_ID ?? env.VERCEL_GIT_COMMIT_SHA);
  const audience =
    env.CLERK_ISSUED_AUDIENCE === undefined
      ? undefined
      : z.string().min(1).max(256).parse(env.CLERK_ISSUED_AUDIENCE);
  return {
    issuer,
    origins,
    publicKey,
    publicKeyId,
    supabaseUrl,
    publishableKey,
    buildId,
    ...(audience ? { audience } : {}),
  };
}
