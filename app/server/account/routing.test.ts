import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import handler from '../../api/account/boundary';
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(
    servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
  servers.length = 0;
});
describe('actual Node adapter / API before SPA', () => {
  it('responds to API as bounded JSON with no config and forbids POST', async () => {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const response = await fetch(`${base}/api/account/boundary?protocolVersion=1&schemaVersion=1`);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toHaveProperty('category', 'unavailable');
    const post = await fetch(`${base}/api/account/boundary`, { method: 'POST', body: 'synthetic' });
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET');
  });
  it('excludes every API path from the SPA rewrite', () => {
    const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    const regex = new RegExp(`^${config.rewrites[0].source}$`);
    expect(regex.test('/api/account/boundary')).toBe(false);
    expect(regex.test('/api/unknown')).toBe(false);
    expect(regex.test('/api')).toBe(false);
    expect(regex.test('/settings')).toBe(true);
  });
});
