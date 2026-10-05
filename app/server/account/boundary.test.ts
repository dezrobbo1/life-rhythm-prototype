import { beforeAll, describe, expect, it, vi } from 'vitest';
import { generateKeyPair, exportSPKI, SignJWT } from 'jose';
import { handleBoundary } from './boundary';
import { readServerConfig, type ServerConfig } from './config';
import { audienceCases } from '../../test/fixtures/audienceCases';
const origin = 'https://app.example.test',
  issuer = 'https://synthetic.clerk.accounts.dev';
const generation = '11111111-1111-4111-8111-111111111111';
let publicKey: string, keys: Awaited<ReturnType<typeof generateKeyPair>>;
beforeAll(async () => {
  keys = await generateKeyPair('RS256');
  publicKey = await exportSPKI(keys.publicKey);
});
const config = () => ({
  issuer,
  origins: [origin],
  publicKey,
  publicKeyId: 'throwaway',
  supabaseUrl: 'https://synthetic.supabase.co',
  publishableKey: 'sb_publishable_synthetic',
  buildId: 'test-build',
});
async function token(claims: Record<string, unknown> = {}) {
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
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: 'throwaway' })
    .sign(keys.privateKey);
}
async function request(
  query = 'protocolVersion=1&schemaVersion=1',
  headers: Record<string, string | undefined> = {},
  method = 'GET',
  claims: Record<string, unknown> = {},
) {
  return new Request(`${origin}/api/account/boundary?${query}`, {
    method,
    headers: {
      origin,
      authorization: `Bearer ${await token(claims)}`,
      ...Object.fromEntries(
        Object.entries(headers).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ),
    },
    ...(method === 'POST' ? { body: 'private content' } : {}),
  });
}
const rows = (
  head: unknown = {
    protocol_version: 1,
    canonical_schema_version: 1,
    revision: '9007199254740993',
    generation,
    updated_at: '2026-10-05T00:00:00Z',
  },
) => [{ enabled: true, account_heads: head }];
function provider(value: unknown = rows(), status = 200) {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
}
async function run(req: Request, fetcher = provider(), cfg: ServerConfig | null = config()) {
  return handleBoundary(req, { config: () => cfg, fetch: fetcher });
}
describe('metadata API', () => {
  it.each(audienceCases)('configured audience: $name', async ({ aud, status }) => {
    const fetcher = provider();
    const res = await run(
      await request(undefined, {}, 'GET', { aud }),
      fetcher,
      { ...config(), audience: 'issued' },
    );
    expect({ status: res.status, providerCalls: fetcher.mock.calls.length }).toEqual({
      status, providerCalls: status === 200 ? 1 : 0,
    });
    if (status === 401) {
      expect(await res.json()).toEqual({
        kind: 'error', category: 'unauthorized', requestId: expect.any(String),
      });
    }
  });
  it('forwards caller bearer per request and only reads own compatible metadata', async () => {
    const req = await request(),
      fetcher = provider();
    const res = await run(req, fetcher);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({
      kind: 'ready',
      protocolVersion: 1,
      schemaVersion: 1,
      buildId: 'test-build',
      head: { revision: '9007199254740993', generation },
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('issuer=eq.');
    expect(url).toContain('subject=eq.user_A');
    expect(new Headers(init.headers).get('authorization')).toBe(req.headers.get('authorization'));
    expect(new Headers(init.headers).get('apikey')).toBe('sb_publishable_synthetic');
    expect(new Headers(init.headers).get('accept-profile')).toBe('life_rhythm');
    expect(init.method).toBe('GET');
  });
  it('keeps A and B request bearer and filter independent', async () => {
    const fetcher = provider();
    await Promise.all([
      run(await request(), fetcher),
      run(await request(undefined, {}, 'GET', { sub: 'user_B', sid: 'sess_B' }), fetcher),
    ]);
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls.some(([url]) => url.includes('subject=eq.user_A'))).toBe(true);
    expect(calls.some(([url]) => url.includes('subject=eq.user_B'))).toBe(true);
    expect(new Headers(calls[0][1].headers).get('authorization')).not.toBe(
      new Headers(calls[1][1].headers).get('authorization'),
    );
  });
  it.each([
    'owner=B',
    'account=B',
    'schemaVersion=1',
    'expectedRevision=0',
    'expectedGeneration=bad',
  ])('rejects extra/invalid query %s before reads', async (extra) => {
    const f = provider();
    expect((await run(await request(`protocolVersion=1&schemaVersion=1&${extra}`), f)).status).toBe(
      400,
    );
    expect(f).not.toHaveBeenCalled();
  });
  it.each([
    { exp: 1 },
    { sid: '' },
    { azp: '' },
    { iss: 'https://foreign.test' },
    { token_type: 'oauth_token' },
    { role: 'service_role' },
    { role: undefined },
  ])('401 rejected sessions avoid provider reads %j', async (claims) => {
    const f = provider();
    expect((await run(await request(undefined, {}, 'GET', claims), f)).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });
  it('denies cookie-only requests', async () => {
    const f = provider();
    expect(
      (
        await run(
          new Request(`${origin}/api/account/boundary?protocolVersion=1&schemaVersion=1`, {
            headers: { origin, cookie: '__session=synthetic' },
          }),
          f,
        )
      ).status,
    ).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });
  it.each([
    { origin: 'https://foreign.test' },
    { origin: 'null' },
    { 'sec-fetch-site': 'cross-site' },
    {},
  ])('denies unapproved origin or missing signals %j', async (headers) => {
    const f = provider();
    const req = await request();
    req.headers.delete('origin');
    for (const [key, value] of Object.entries(headers)) req.headers.set(key, value);
    expect((await run(req, f)).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });
  it('allows same-origin GET with no Origin', async () => {
    const req = await request();
    req.headers.delete('origin');
    req.headers.set('sec-fetch-site', 'same-origin');
    expect((await run(req)).status).toBe(200);
  });
  it('denies approved origin with a foreign request URL', async () => {
    const req = await request();
    const foreign = new Request(req.url.replace(origin, 'https://foreign.test'), {
      headers: req.headers,
    });
    expect((await run(foreign)).status).toBe(403);
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])('disables %s', async (method) => {
    const f = provider();
    expect((await run(await request(undefined, {}, method), f)).status).toBe(405);
    expect(f).not.toHaveBeenCalled();
  });
  it.each([
    { authorization: 'Bearer ' + 'a'.repeat(8193) },
    { 'content-length': '1' },
    { 'x-owner': 'B' },
  ])('rejects bounded/header/body shape %j', async (headers) => {
    const f = provider();
    expect((await run(await request(undefined, headers), f)).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it.each(
    [[], [{ enabled: false, account_heads: null }], [...rows(), ...rows()]].map((value) => [value]),
  )('denies missing disabled or multiple access rows %j', async (value) =>
    expect((await run(await request(), provider(value))).status).toBe(value.length > 1 ? 503 : 403),
  );
  it('returns null without writing for no head', async () => {
    const res = await run(await request(), provider(rows(null)));
    expect(await res.json()).toHaveProperty('head', null);
  });
  it.each(
    [
      rows({
        protocol_version: 2,
        canonical_schema_version: 1,
        revision: '1',
        generation,
        updated_at: '2026-10-05T00:00:00Z',
      }),
      rows({
        protocol_version: 1,
        canonical_schema_version: 2,
        revision: '1',
        generation,
        updated_at: '2026-10-05T00:00:00Z',
      }),
    ].map((value) => [value]),
  )('fails stored compatibility %j', async (value) =>
    expect((await run(await request(), provider(value))).status).toBe(426),
  );
  it.each(
    [
      rows({
        protocol_version: 1,
        canonical_schema_version: 1,
        revision: 9007199254740993,
        generation,
      }),
      [{ enabled: true, account_heads: [rows()[0].account_heads, rows()[0].account_heads] }],
      rows({ privateProfile: 'NEVER_ECHO' }),
    ].map((value) => [value]),
  )('fails unreadable metadata %j', async (value) =>
    expect((await run(await request(), provider(value))).status).toBe(503),
  );
  it('checks client versions before reads', async () => {
    const f = provider();
    expect((await run(await request('protocolVersion=2&schemaVersion=1'), f)).status).toBe(426);
    expect(f).not.toHaveBeenCalled();
  });
  it('compares exact head and preserves compatible own head on conflict', async () => {
    for (const revision of ['9007199254740993', '9007199254740992']) {
      const res = await run(
        await request(
          `protocolVersion=1&schemaVersion=1&expectedRevision=${revision}&expectedGeneration=${generation}`,
        ),
      );
      expect(res.status).toBe(revision === '9007199254740993' ? 200 : 409);
      expect(await res.json()).toHaveProperty('head.revision', '9007199254740993');
    }
  });
  it('conflicts on generation change or no head', async () => {
    const req = await request(
      `protocolVersion=1&schemaVersion=1&expectedRevision=1&expectedGeneration=${generation}`,
    );
    expect((await run(req, provider(rows(null)))).status).toBe(409);
    expect((await run(req)).status).toBe(409);
  });
  it('sanitizes provider errors and missing configuration', async () => {
    for (const cfg of [null, config()]) {
      const res = await run(await request(), provider({ message: 'NEVER_ECHO' }, 500), cfg);
      expect(res.status).toBe(503);
      expect(await res.text()).not.toContain('NEVER_ECHO');
    }
  });
  it('bounds provider responses', async () =>
    expect((await run(await request(), provider('x'.repeat(20000)))).status).toBe(503));
});
describe('public verification/runtime config', () => {
  const env = () => ({
    CLERK_ISSUER: issuer,
    CLERK_JWT_PUBLIC_KEY: publicKey,
    CLERK_JWT_KEY_ID: 'throwaway',
    LIFE_RHYTHM_ALLOWED_ORIGINS: origin,
    SUPABASE_URL: 'https://synthetic.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic',
    LIFE_RHYTHM_BUILD_ID: 'test-build',
  });
  it('accepts public verification settings', () =>
    expect(readServerConfig(env())).toEqual(config()));
  it.each([
    'CLERK_ISSUER',
    'CLERK_JWT_PUBLIC_KEY',
    'CLERK_JWT_KEY_ID',
    'LIFE_RHYTHM_ALLOWED_ORIGINS',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'LIFE_RHYTHM_BUILD_ID',
  ])('rejects missing %s', (key) => {
    const value = env();
    delete value[key as keyof typeof value];
    expect(() => readServerConfig(value)).toThrow();
  });
  it.each([
    { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never' },
    { SUPABASE_PUBLISHABLE_KEY: 'eyJlegacy' },
    { CLERK_ISSUER: 'http://foreign.test' },
    { LIFE_RHYTHM_ALLOWED_ORIGINS: '*' },
    { LIFE_RHYTHM_ALLOWED_ORIGINS: origin + '/path' },
    { CLERK_JWT_PUBLIC_KEY: 'broken' },
    { SUPABASE_URL: 'https://unrelated.test' },
  ])('rejects wrong config %j', (override) =>
    expect(() => readServerConfig({ ...env(), ...override })).toThrow(),
  );
});
