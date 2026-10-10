import { randomUUID } from 'node:crypto';
import {
  boundaryResponseSchema,
  parseBoundaryQuery,
  guardExpectedHead,
  type BoundaryResponse,
} from '../../src/account/accountBoundarySchema.js';
import { readServerConfig, type ServerConfig } from './config.js';
import { verifySession } from './session.js';
import { BoundaryFailure, readOwnHead } from './headRepository.js';
type Dependencies = { config?: () => ServerConfig | null; fetch?: typeof fetch };
function reply(body: BoundaryResponse, status: number) {
  return Response.json(boundaryResponseSchema.parse(body), {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: 'Origin, Authorization',
      'X-Content-Type-Options': 'nosniff',
      ...(status === 405 ? { Allow: 'GET' } : {}),
    },
  });
}
export async function handleBoundary(request: Request, deps: Dependencies = {}): Promise<Response> {
  const requestId = randomUUID();
  try {
    if (request.method !== 'GET') throw new BoundaryFailure(405, 'method-not-allowed');
    // Reject owner override headers and bodies as well as unknown query parameters.
    const url = new URL(request.url);
    const bytes = [...request.headers].reduce((count, [k, v]) => count + k.length + v.length, 0);
    if (
      bytes > 16384 ||
      request.url.length > 1024 ||
      request.body ||
      request.headers.has('transfer-encoding') ||
      (request.headers.has('content-length') && request.headers.get('content-length') !== '0') ||
      [...request.headers.keys()].some((key) => /^(x-)?(owner|account|user-id)$/.test(key))
    )
      throw new BoundaryFailure(400, 'invalid-request');
    let query: ReturnType<typeof parseBoundaryQuery>;
    try {
      query = parseBoundaryQuery(url.search);
    } catch {
      throw new BoundaryFailure(400, 'invalid-request');
    }
    const auth = request.headers.get('authorization');
    if (auth && auth.length > 8199) throw new BoundaryFailure(400, 'invalid-request');
    const config = (deps.config ?? readServerConfig)();
    if (!config) throw new BoundaryFailure(503, 'unavailable');
    const origin = request.headers.get('origin');
    if (
      !config.origins.includes(url.origin) ||
      (origin !== null
        ? !config.origins.includes(origin) || origin !== url.origin
        : request.headers.get('sec-fetch-site') !== 'same-origin')
    )
      throw new BoundaryFailure(403, 'forbidden');
    if (!auth || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth))
      throw new BoundaryFailure(401, 'unauthorized');
    const bearer = auth.slice(7);
    let account: Awaited<ReturnType<typeof verifySession>>;
    try {
      account = await verifySession(bearer, config);
    } catch {
      throw new BoundaryFailure(401, 'unauthorized');
    }
    if (query.protocolVersion !== 1 || query.schemaVersion !== 1)
      throw new BoundaryFailure(426, 'upgrade-required');
    const head = await readOwnHead(account, bearer, config, deps.fetch);
    if (!guardExpectedHead(head, query.expected))
      return reply({ kind: 'conflict', category: 'conflict', requestId, head }, 409);
    return reply(
      { kind: 'ready', protocolVersion: 1, schemaVersion: 1, buildId: config.buildId, head },
      200,
    );
  } catch (error) {
    const failure =
      error instanceof BoundaryFailure ? error : new BoundaryFailure(503, 'unavailable');
    // No raw exception, request/token/account identifiers, or provider text enters logs/responses.
    return reply({ kind: 'error', category: failure.category, requestId }, failure.status);
  }
}
