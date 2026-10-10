import { expect, it } from 'vitest';
import { assertClientPrivacy } from './check-client-privacy.mjs';
it('permits the SDK secret-key prefix check without permitting a credential', () => {
  expect(() =>
    assertClientPrivacy('key.startsWith("sb_secret_")'),
  ).not.toThrow();
});
it('rejects a synthetic credential-shaped secret key without echoing its value', () => {
  const value = 'sb_secret_SYNTHETIC_FORBIDDEN_VALUE_123456789';
  expect(() => assertClientPrivacy(value)).toThrow();
  try {
    assertClientPrivacy(value);
  } catch (error) {
    expect(String(error)).not.toContain(value);
  }
});
it('rejects server-only public trust and synthetic session/private-key fixture markers', () => {
  for (const value of [
    'SUPABASE_AUTH_JWKS',
    'synthetic.session.token',
    '-----BEGIN PRIVATE KEY-----',
  ])
    expect(() => assertClientPrivacy(value)).toThrow();
});
