import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPair, exportSPKI, exportJWK, importJWK, SignJWT } from 'jose';
import { verifySession } from './session';
let keys: Awaited<ReturnType<typeof generateKeyPair>>, foreign: typeof keys, publicKey: string;
let jwksServer: ReturnType<typeof createServer>;
const issuer = 'https://synthetic.clerk.accounts.dev',
  origin = 'https://app.example.test';
beforeAll(async () => {
  keys = await generateKeyPair('RS256');
  foreign = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'ephemeral', alg: 'RS256', use: 'sig' };
  jwksServer = createServer((req, res) => {
    if (req.url !== '/.well-known/jwks.json') {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
  const jwks = await (
    await fetch(
      `http://127.0.0.1:${(jwksServer.address() as AddressInfo).port}/.well-known/jwks.json`,
    )
  ).json();
  const localKey = await importJWK(jwks.keys[0], 'RS256');
  publicKey = await exportSPKI(localKey as CryptoKey);
});
afterAll(async () => {
  await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
});
async function token(
  overrides: Record<string, unknown> = {},
  key = keys.privateKey,
  alg = 'RS256',
  kid = 'ephemeral',
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: issuer,
    sub: 'user_A',
    sid: 'sess_A',
    role: 'authenticated',
    azp: origin,
    iat: now,
    nbf: now - 1,
    exp: now + 60,
    ...overrides,
  })
    .setProtectedHeader({ alg, typ: 'JWT', kid })
    .sign(key);
}
async function verify(bearer: string, audience?: string) {
  return verifySession(bearer, {
    issuer,
    origins: [origin],
    publicKey,
    publicKeyId: 'ephemeral',
    audience,
  });
}
describe('real SDK cryptographic session verification', () => {
  it('accepts a signed short lived session with exact identity', async () =>
    expect(await verify(await token())).toEqual({
      issuer,
      subject: 'user_A',
      sessionId: 'sess_A',
    }));
  it.each([
    { exp: 1 },
    { nbf: Math.floor(Date.now() / 1000) + 600 },
    { iss: 'https://foreign.test' },
    { sub: '' },
    { sid: '' },
    { azp: '' },
    { azp: 'https://foreign.test' },
    { token_type: 'm2m_token' },
    { sub: 'machine_A' },
    { sid: 'machine_A' },
    { role: undefined },
    { role: 'anon' },
    { role: 'service_role' },
  ])('denies claims %j', async (claims) => expect(verify(await token(claims))).rejects.toThrow());
  it('denies unknown signing-key ID even with a valid trusted signature', async () =>
    expect(verify(await token({}, keys.privateKey, 'RS256', 'unknown'))).rejects.toThrow());
  it('denies a foreign signing key', async () =>
    expect(verify(await token({}, foreign.privateKey))).rejects.toThrow());
  it('denies a tampered signature', async () => {
    const t = await token();
    const parts = t.split('.');
    parts[2] = 'AAAA' + parts[2].slice(4);
    await expect(verify(parts.join('.'))).rejects.toThrow();
  });
  it('denies an unsupported algorithm', async () => {
    const ec = await generateKeyPair('ES256');
    await expect(verify(await token({}, ec.privateKey, 'ES256'))).rejects.toThrow();
  });
  it('checks only an explicitly configured audience', async () => {
    await expect(verify(await token({ aud: 'other' }), 'issued')).rejects.toThrow();
    expect(await verify(await token({ aud: 'issued' }), 'issued')).toHaveProperty(
      'subject',
      'user_A',
    );
    expect(await verify(await token())).toHaveProperty('subject', 'user_A');
  });
  it('fails closed for broken verification configuration', async () =>
    expect(
      verifySession(await token(), {
        issuer,
        origins: [origin],
        publicKey: 'broken',
        publicKeyId: 'ephemeral',
      }),
    ).rejects.toThrow());
});
