import { readdirSync, readFileSync } from 'node:fs';
const forbidden = [
  '-----BEGIN PRIVATE KEY-----',
  '-----BEGIN RSA PRIVATE KEY-----',
  'sb_secret_',
  'SUPABASE_PUBLISHABLE_KEY',
  'CLERK_JWT_PUBLIC_KEY',
  'CLERK_JWT_KEY_ID',
  'synthetic.session.token',
  'Ordinary synthetic app',
  'NEVER_ECHO',
];
for (const file of readdirSync('dist/assets')) {
  const text = readFileSync(`dist/assets/${file}`, 'utf8');
  for (const marker of forbidden)
    if (text.includes(marker)) throw new Error(`Forbidden client marker: ${marker}`);
}
console.log(
  'PASS: built client contains no server config, private key, privileged key, synthetic token or browser fixture',
);
