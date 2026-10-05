import { z } from 'zod';
export const PROTOCOL_VERSION = 1;
export const CANONICAL_SCHEMA_VERSION = 1;
export const revisionSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n);
export const headSchema = z
  .object({ revision: revisionSchema, generation: z.string().uuid() })
  .strict();
export type Head = z.infer<typeof headSchema>;
export const errorCategorySchema = z.enum([
  'invalid-request',
  'unauthorized',
  'forbidden',
  'conflict',
  'upgrade-required',
  'unavailable',
  'method-not-allowed',
]);
export const boundaryResponseSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('ready'),
      protocolVersion: z.literal(1),
      schemaVersion: z.literal(1),
      buildId: z.string().min(1).max(128),
      head: headSchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('error'),
      category: errorCategorySchema,
      requestId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('conflict'),
      category: z.literal('conflict'),
      requestId: z.string().uuid(),
      head: headSchema.nullable(),
    })
    .strict(),
]);
export type BoundaryResponse = z.infer<typeof boundaryResponseSchema>;
export function parseBoundaryQuery(search: string) {
  if (search.length > 512) throw new Error('invalid-request');
  const params = new URLSearchParams(search);
  const allowed = ['protocolVersion', 'schemaVersion', 'expectedRevision', 'expectedGeneration'];
  for (const key of params.keys())
    if (!allowed.includes(key) || params.getAll(key).length !== 1)
      throw new Error('invalid-request');
  const version = (key: string) =>
    z
      .string()
      .regex(/^[1-9][0-9]{0,3}$/)
      .parse(params.get(key));
  const protocolVersion = Number(version('protocolVersion')),
    schemaVersion = Number(version('schemaVersion'));
  const revision = params.get('expectedRevision'),
    generation = params.get('expectedGeneration');
  if ((revision === null) !== (generation === null)) throw new Error('invalid-request');
  return {
    protocolVersion,
    schemaVersion,
    expected: revision === null ? undefined : headSchema.parse({ revision, generation }),
  };
}
/** Comparison fence only; C2/C3 writes must be transactional compare-and-swap. */
export function guardExpectedHead(head: Head | null, expected?: Head) {
  return (
    !expected ||
    (!!head && head.revision === expected.revision && head.generation === expected.generation)
  );
}
