import { readdirSync, readFileSync } from 'node:fs';
const forbidden = [
  '-----BEGIN PRIVATE KEY-----',
  '-----BEGIN RSA PRIVATE KEY-----',
  'SUPABASE_AUTH_JWKS',
  'CLERK_JWT_PUBLIC_KEY',
  'CLERK_JWT_KEY_ID',
  'synthetic.session.token',
  'Ordinary synthetic app',
  'NEVER_ECHO',
];
export function assertClientPrivacy(text) {
  // Supabase SDK contains the bare prefix in its key-type check; a value is forbidden.
  if (/sb_secret_[A-Za-z0-9_-]+/.test(text))
    throw new Error('Forbidden client credential');
  for (const marker of forbidden)
    if (text.includes(marker))
      throw new Error(`Forbidden client marker: ${marker}`);
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  for (const file of readdirSync('dist/assets'))
    assertClientPrivacy(readFileSync(`dist/assets/${file}`, 'utf8'));
  console.log(
    'PASS: built client contains no server config, private key, privileged key, synthetic token or browser fixture',
  );
}
