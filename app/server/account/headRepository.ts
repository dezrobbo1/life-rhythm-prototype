import { boundedJson } from '../../src/account/boundedJson.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { headSchema, revisionSchema, type Head } from '../../src/account/accountBoundarySchema.js';
import type { ServerConfig } from './config.js';
import type { VerifiedAccount } from './session.js';
export class BoundaryFailure extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 409 | 426 | 503 | 405,
    public readonly category:
      | 'invalid-request'
      | 'unauthorized'
      | 'forbidden'
      | 'conflict'
      | 'upgrade-required'
      | 'unavailable'
      | 'method-not-allowed',
  ) {
    super(category);
  }
}
const storedHeadSchema = z
  .object({
    protocol_version: z.number().int().positive(),
    canonical_schema_version: z.number().int().positive(),
    revision: revisionSchema,
    generation: headSchema.shape.generation,
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict();
const accessRowsSchema = z
  .array(z.object({ enabled: z.boolean(), account_heads: storedHeadSchema.nullable() }).strict())
  .max(1);
/** One statement snapshot: active access and head are both fenced by provider RLS. */
export async function readOwnHead(
  account: VerifiedAccount,
  bearer: string,
  config: ServerConfig,
  fetcher: typeof fetch = fetch,
): Promise<Head | null> {
  const timeout = AbortSignal.timeout(5000);
  const boundedFetch: typeof fetch = async (input, init) => {
    const response = await fetcher(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([timeout, init.signal]) : timeout,
      redirect: 'error',
      cache: 'no-store',
    });
    const json = await boundedJson(response);
    return new Response(JSON.stringify(json), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  };
  // Allocate for every caller; never persist a session or substitute an operator/service-role key.
  const client = createClient(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${bearer}` }, fetch: boundedFetch },
  });
  const { data, error } = await client
    .schema('life_rhythm')
    .from('trial_access')
    .select(
      'enabled,account_heads(protocol_version,canonical_schema_version,revision::text,generation,updated_at)',
    )
    .eq('issuer', account.issuer)
    .eq('subject', account.subject)
    .eq('enabled', true)
    .limit(2)
    .retry(false);
  if (error) throw new BoundaryFailure(503, 'unavailable');
  const rows = accessRowsSchema.parse(data);
  if (rows.length !== 1 || !rows[0].enabled) throw new BoundaryFailure(403, 'forbidden');
  const head = rows[0].account_heads;
  if (!head) return null;
  if (head.protocol_version !== 1 || head.canonical_schema_version !== 1)
    throw new BoundaryFailure(426, 'upgrade-required');
  return headSchema.parse({ revision: head.revision, generation: head.generation });
}
