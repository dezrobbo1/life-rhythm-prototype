// Isolated synthetic integration only. Ephemeral signing keys never leave memory.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { exportJWK, exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { handleBoundary } from '../server/account/boundary';
const suffix = randomUUID().slice(0, 8),
  network = `lr-c1-${suffix}`,
  db = `lr-c1-db-${suffix}`,
  api = `lr-c1-api-${suffix}`;
const docker = (...args: string[]) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const sql = (input: string) =>
  execFileSync(
    'docker',
    ['exec', '-i', db, 'psql', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
const keys = await generateKeyPair('RS256');
const publicKey = await exportSPKI(keys.publicKey),
  publicKeyId = 'ephemeral-data-api';
const jwk = { ...(await exportJWK(keys.publicKey)), kid: publicKeyId, alg: 'RS256', use: 'sig' };
const issuer = 'https://synthetic.clerk.accounts.dev',
  origin = 'https://app.example.test';
async function token(subject: string) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: issuer,
    sub: subject,
    sid: 'sess_synthetic',
    role: 'authenticated',
    azp: origin,
    iat: now,
    nbf: now - 1,
    exp: now + 60,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: publicKeyId })
    .sign(keys.privateKey);
}
let checks = 0;
try {
  docker('network', 'create', network);
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    db,
    '--network',
    network,
    '--tmpfs',
    '/var/lib/postgresql/data',
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    'postgres:17',
  );
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker('exec', db, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres');
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  const migration = readdirSync('supabase/migrations').find((name) =>
    name.endsWith('_account_boundary.sql'),
  )!;
  sql(
    readFileSync('supabase/tests/bootstrap.sql', 'utf8') +
      readFileSync(`supabase/migrations/${migration}`, 'utf8') +
      readFileSync('supabase/tests/fixtures.sql', 'utf8') +
      `\ncreate role authenticator login noinherit; grant anon,authenticated to authenticator;`,
  );
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    api,
    '--network',
    network,
    '-p',
    '127.0.0.1::3000',
    '-e',
    `PGRST_DB_URI=postgres://authenticator@${db}:5432/postgres`,
    '-e',
    'PGRST_DB_SCHEMAS=life_rhythm',
    '-e',
    'PGRST_DB_ANON_ROLE=anon',
    '-e',
    `PGRST_JWT_SECRET=${JSON.stringify({ keys: [jwk] })}`,
    'postgrest/postgrest:v13.0.7',
  );
  const port = docker('port', api, '3000/tcp').split(':').at(-1),
    base = `http://127.0.0.1:${port}`;
  const readinessToken = await token('user_A');
  let healthy = false,
    lastCode = 'not-ready';
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(base + '/account_heads?select=subject&limit=0', {
        headers: { 'Accept-Profile': 'life_rhythm', Authorization: `Bearer ${readinessToken}` },
      });
      if (response.status === 200) {
        healthy = true;
        break;
      }
      const body = await response.json();
      lastCode = String(body.code ?? response.status);
    } catch {
      lastCode = 'connection';
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.ok(healthy, `Local Data API unavailable: ${lastCode}`);
  const a = await token('user_A'),
    b = await token('user_B');
  const direct = (path: string, bearer?: string, init: RequestInit = {}) =>
    fetch(base + path, {
      ...init,
      headers: {
        'Accept-Profile': 'life_rhythm',
        'Content-Profile': 'life_rhythm',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...init.headers,
      },
    });
  const read = async (bearer: string) => {
    const response = await direct('/account_heads?select=subject,revision::text', bearer);
    assert.equal(response.status, 200);
    checks++;
    return response.json();
  };
  assert.deepEqual(await read(a), [{ subject: 'user_A', revision: '9007199254740993' }]);
  checks++;
  assert.deepEqual(await read(b), [{ subject: 'user_B', revision: '42' }]);
  checks++;
  const query =
    '?select=enabled,account_heads(protocol_version,canonical_schema_version,revision::text,generation,updated_at)&issuer=eq.' +
    encodeURIComponent(issuer) +
    '&subject=eq.user_A&enabled=eq.true&limit=2';
  const relation = await (await direct('/trial_access' + query, a)).json();
  assert.equal(typeof relation[0].account_heads, 'object');
  assert.equal(relation[0].account_heads.revision, '9007199254740993');
  checks += 2;
  const config = {
    issuer,
    origins: [origin],
    publicKey,
    publicKeyId,
    supabaseUrl: 'https://synthetic.supabase.co',
    publishableKey: 'sb_publishable_synthetic',
    buildId: 'local-integration',
  };
  const providerFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    return fetch(base + url.pathname.replace(/^\/rest\/v1/, '') + url.search, init);
  };
  const boundary = (bearer: string, query = 'protocolVersion=1&schemaVersion=1') =>
    handleBoundary(
      new Request(`${origin}/api/account/boundary?${query}`, {
        headers: { origin, authorization: `Bearer ${bearer}` },
      }),
      { config: () => config, fetch: providerFetch },
    );
  const ready = await boundary(a);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).head.revision, '9007199254740993');
  checks += 2;
  assert.equal((await boundary(b)).status, 200);
  checks++;
  assert.equal((await boundary(await token('user_uninvited'))).status, 403);
  checks++;
  assert.equal((await boundary(await token('user_disabled'))).status, 403);
  checks++;
  assert.equal((await boundary(a, 'protocolVersion=1&schemaVersion=1&owner=user_B')).status, 400);
  checks++;
  assert.equal((await boundary(a, 'protocolVersion=2&schemaVersion=1')).status, 426);
  checks++;
  assert.equal(
    (
      await boundary(
        a,
        'protocolVersion=1&schemaVersion=1&expectedRevision=42&expectedGeneration=11111111-1111-4111-8111-111111111111',
      )
    ).status,
    409,
  );
  checks++;
  assert.equal((await direct('/account_heads')).status, 401);
  checks++;
  for (const path of ['/trial_access', '/account_heads'])
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const response = await direct(path, a, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'DELETE'
          ? {}
          : {
              body: JSON.stringify(
                method === 'POST'
                  ? path === '/trial_access'
                    ? { issuer, subject: 'user_C', enabled: true }
                    : {
                        issuer,
                        subject: 'user_C',
                        protocol_version: 1,
                        canonical_schema_version: 1,
                        revision: '0',
                        generation: '11111111-1111-4111-8111-111111111111',
                      }
                  : { subject: 'user_B' },
              ),
            }),
      });
      assert.ok([401, 403].includes(response.status), `${method} ${path}: ${response.status}`);
      checks++;
    }
  sql(`update life_rhythm.trial_access set enabled=false where subject='user_A';`);
  assert.deepEqual(await read(a), []);
  checks++;
  assert.equal((await boundary(a)).status, 403);
  checks++;
  console.log(
    `PASS: ${checks} local signed-JWT PostgREST/SDK/API checks; no native hosted Clerk trust claim`,
  );
} finally {
  for (const name of [api, db])
    try {
      docker('rm', '-f', name);
    } catch {}
  try {
    docker('network', 'rm', network);
  } catch {}
}
