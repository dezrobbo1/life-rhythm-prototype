import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { handleBoundary } from '../../server/account/boundary.js';
/** Vercel Node entry; raw-header checks happen before constructing Fetch headers. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  let response: Response;
  try {
    const raw = req.rawHeaders;
    const names = raw.filter((_, index) => index % 2 === 0).map((name) => name.toLowerCase());
    if (
      raw.reduce((size, value) => size + value.length, 0) > 16384 ||
      (req.url?.length ?? 0) > 1024 ||
      ['authorization', 'origin', 'host', 'content-length', 'transfer-encoding'].some(
        (name) => names.filter((value) => value === name).length > 1,
      )
    )
      throw new Error('invalid-request');
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers))
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(',') : value);
    // Host/protocol construct the actual request URL only; trust comes from fixed configured origins.
    const protocol =
      headers.get('x-forwarded-proto') ?? ('encrypted' in req.socket ? 'https' : 'http');
    if (protocol !== 'https' && protocol !== 'http') throw new Error('invalid-request');
    const url = new URL(req.url ?? '/', `${protocol}://${headers.get('host') ?? 'invalid'}`);
    response = await handleBoundary(new Request(url, { method: req.method ?? 'GET', headers }));
  } catch {
    response = Response.json(
      { kind: 'error', category: 'invalid-request', requestId: randomUUID() },
      {
        status: 400,
        headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
      },
    );
  }
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(req.method === 'HEAD' ? undefined : await response.text());
}
