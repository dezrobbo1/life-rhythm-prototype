import { describe, it, expect } from 'vitest';
import {
  revisionSchema,
  parseBoundaryQuery,
  guardExpectedHead,
  boundaryResponseSchema,
} from './accountBoundarySchema';
const generation = '11111111-1111-4111-8111-111111111111';
describe('boundary protocol', () => {
  it.each(['0', '1', '9007199254740993', '9223372036854775807'])('preserves bigint %s', (value) =>
    expect(revisionSchema.parse(value)).toBe(value),
  );
  it.each(['01', '-1', '1.0', '1e3', '9223372036854775808', '', 1])(
    'rejects revision %s',
    (value) => expect(revisionSchema.safeParse(value).success).toBe(false),
  );
  it.each([
    '',
    '?protocolVersion=1',
    '?protocolVersion=1&schemaVersion=1&owner=B',
    '?protocolVersion=1&schemaVersion=1&schemaVersion=1',
    '?protocolVersion=1&schemaVersion=1&expectedRevision=1',
    '?protocolVersion=1&schemaVersion=01',
  ])('rejects invalid query %s', (q) => expect(() => parseBoundaryQuery(q)).toThrow());
  it('accepts exact versions and paired expectations', () =>
    expect(
      parseBoundaryQuery(
        `?protocolVersion=1&schemaVersion=1&expectedRevision=9007199254740993&expectedGeneration=${generation}`,
      ),
    ).toEqual({
      protocolVersion: 1,
      schemaVersion: 1,
      expected: { revision: '9007199254740993', generation },
    }));
  it('detects both reset and revision conflict without coercion', () => {
    const head = { revision: '9007199254740993', generation };
    expect(guardExpectedHead(head, head)).toBe(true);
    expect(guardExpectedHead(head, { ...head, revision: '9007199254740992' })).toBe(false);
    expect(
      guardExpectedHead(head, { ...head, generation: '22222222-2222-4222-8222-222222222222' }),
    ).toBe(false);
    expect(guardExpectedHead(null, head)).toBe(false);
    expect(guardExpectedHead(null)).toBe(true);
  });
  it('rejects unknown response metadata and unsupported versions', () => {
    const body = {
      kind: 'ready',
      protocolVersion: 1,
      schemaVersion: 1,
      buildId: 'test',
      head: null,
    };
    expect(boundaryResponseSchema.safeParse(body).success).toBe(true);
    expect(boundaryResponseSchema.safeParse({ ...body, profile: {} }).success).toBe(false);
    expect(boundaryResponseSchema.safeParse({ ...body, protocolVersion: 2 }).success).toBe(false);
  });
});
