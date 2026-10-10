import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPair, exportJWK, importJWK, SignJWT } from 'jose';
import { verifySession } from './session';
let keys: Awaited<ReturnType<typeof generateKeyPair>>,
  foreign: typeof keys,
  jwks: {
    keys: ReturnType<typeof exportJWK> extends Promise<infer T> ? T[] : never;
  };
let jwksServer: ReturnType<typeof createServer>;
const issuer = 'https://synthetic.supabase.co/auth/v1',
  origin = 'https://app.example.test';
beforeAll(async () => {
  keys = await generateKeyPair('RS256');
  foreign = await generateKeyPair('RS256');
  const jwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: 'ephemeral',
    alg: 'RS256',
    use: 'sig',
  };
  jwksServer = createServer((req, res) => {
    if (req.url !== '/.well-known/jwks.json') {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) =>
    jwksServer.listen(0, '127.0.0.1', resolve),
  );
  const served = await (
    await fetch(
      `http://127.0.0.1:${(jwksServer.address() as AddressInfo).port}/.well-known/jwks.json`,
    )
  ).json();
  const localKey = await importJWK(served.keys[0], 'RS256');
  jwks = { keys: [await exportJWK(localKey)] };
  Object.assign(jwks.keys[0], { kid: 'ephemeral', alg: 'RS256', use: 'sig' });
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
    sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    session_id: '11111111-1111-4111-8111-111111111111',
    role: 'authenticated',
    aud: 'authenticated',
    is_anonymous: false,
    aal: 'aal1',
    iat: now,
    nbf: now - 1,
    exp: now + 60,
    ...overrides,
  })
    .setProtectedHeader({ alg, typ: 'JWT', kid })
    .sign(key);
}
async function verify(bearer: string) {
  return verifySession(bearer, {
    issuer,
    origins: [origin],
    jwks,
  });
}
describe('real SDK cryptographic session verification', () => {
  it('accepts a signed short lived session with exact identity', async () =>
    expect(await verify(await token())).toEqual({
      issuer,
      subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sessionId: '11111111-1111-4111-8111-111111111111',
    }));
  it.each([
    { exp: 1 },
    { exp: undefined },
    { exp: '9999999999' },
    { iat: undefined },
    { iat: Math.floor(Date.now() / 1000) + 600 },
    { aud: ['authenticated', 7] },
    { aud: [] },
    { session_id: undefined },
    { ref: 'synthetic' },
    { nbf: Math.floor(Date.now() / 1000) + 600 },
    { iss: 'https://foreign.test' },
    { sub: '' },
    { session_id: '' },
    { aud: undefined },
    { aud: 'anon' },
    { is_anonymous: true },
    { is_anonymous: undefined },
    { aal: 'bad' },
    { client_id: 'oauth-app' },
    { token_type: 'm2m_token' },
    { sub: 'machine_A' },
    { session_id: 'machine_A' },
    { role: undefined },
    { role: 'anon' },
    { role: 'service_role' },
  ])('denies claims %j', async (claims) =>
    expect(verify(await token(claims))).rejects.toThrow(),
  );
  it('accepts native ES256 public-key verification', async () => {
    const ec = await generateKeyPair('ES256');
    const jwk = {
      ...(await exportJWK(ec.publicKey)),
      kid: 'ec',
      alg: 'ES256',
      use: 'sig',
    };
    expect(
      await verifySession(await token({}, ec.privateKey, 'ES256', 'ec'), {
        issuer,
        origins: [origin],
        jwks: { keys: [jwk] },
      }),
    ).toHaveProperty('subject');
  });
  it('denies unknown signing-key ID even with a valid trusted signature', async () =>
    expect(
      verify(await token({}, keys.privateKey, 'RS256', 'unknown')),
    ).rejects.toThrow());
  it('denies a foreign signing key', async () =>
    expect(verify(await token({}, foreign.privateKey))).rejects.toThrow());
  it('denies a tampered signature', async () => {
    const t = await token();
    const parts = t.split('.');
    parts[2] = 'AAAA' + parts[2].slice(4);
    await expect(verify(parts.join('.'))).rejects.toThrow();
  });
  it('denies an unconfigured EC key/algorithm', async () => {
    const ec = await generateKeyPair('ES256');
    await expect(
      verify(await token({}, ec.privateKey, 'ES256')),
    ).rejects.toThrow();
  });
  it('accepts optional absent nbf and rejects malformed optional nbf', async () => {
    expect(await verify(await token({ nbf: undefined }))).toHaveProperty(
      'subject',
    );
    await expect(verify(await token({ nbf: '0' }))).rejects.toThrow();
  });
  it.each(['', 'a.b.c', 'a'.repeat(9000), 'e30.e30.', 'x.y.z.extra'])(
    'rejects malformed token %s',
    async (t) => {
      await expect(verify(t)).rejects.toThrow();
    },
  );
  it('fails closed for broken verification configuration', async () =>
    expect(
      verifySession(await token(), {
        issuer,
        origins: [origin],
        jwks: { keys: [] },
      }),
    ).rejects.toThrow());
});
