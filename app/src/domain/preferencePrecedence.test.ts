import { describe, expect, it } from 'vitest';
import {
  comparePreferencePrecedence, preferencePrecedence, resolvePreferencePrecedence,
  type PreferencePrecedenceCandidate, type PreferencePrecedenceSource,
} from './preferencePrecedence';

const scopeKey = 'admin:2026-09-26:08:00-09:00';
const candidate = (
  id: string, source: PreferencePrecedenceSource, relation: 'prefer' | 'avoid' = 'prefer', scope = scopeKey,
): PreferencePrecedenceCandidate => ({ id, source, relation, scopeKey: scope });

describe('Gate 7C preference precedence', () => {
  it('encodes the documented hierarchy exactly', () => {
    expect(preferencePrecedence).toEqual([
      'currentInstruction', 'explicitPersistent', 'personallyTestedRule',
      'strongRepeatedAssociation', 'weakAssociation', 'populationInformedDefault',
    ]);
  });
  it('enforces all ordered precedence pairs, not just one explicit/inferred example', () => {
    for (let i = 0; i < preferencePrecedence.length; i += 1) {
      for (let j = i + 1; j < preferencePrecedence.length; j += 1) {
        const high = candidate('high', preferencePrecedence[i], 'avoid');
        const low = candidate('low', preferencePrecedence[j]);
        expect(comparePreferencePrecedence(high.source, low.source)).toBeLessThan(0);
        expect(resolvePreferencePrecedence([low, high], scopeKey)).toEqual({
          status: 'resolved', scopeKey, source: high.source, selected: [high],
        });
      }
    }
  });
  it('returns highest-rank contradictions without resolving them by lower-rank evidence or ID', () => {
    const prefer = candidate('z', 'explicitPersistent');
    const avoid = candidate('A', 'explicitPersistent', 'avoid');
    const lower = candidate('lower', 'strongRepeatedAssociation');
    expect(resolvePreferencePrecedence([prefer, lower, avoid], scopeKey)).toEqual({
      status: 'conflict', scopeKey, source: 'explicitPersistent', selected: [avoid, prefer],
    });
  });
  it('does not let an unrelated current instruction suppress another target/context', () => {
    const explicit = candidate('explicit', 'explicitPersistent');
    const unrelated = candidate('current', 'currentInstruction', 'avoid', 'exercise:2026-09-26:18:00');
    expect(resolvePreferencePrecedence([unrelated, explicit], scopeKey)).toEqual({
      status: 'resolved', scopeKey, source: 'explicitPersistent', selected: [explicit],
    });
  });
  it('keeps matching same-rank candidates and is independent of input order without mutating inputs', () => {
    const inputs = [candidate('z', 'explicitPersistent'), candidate('A', 'explicitPersistent')];
    const before = structuredClone(inputs);
    const forward = resolvePreferencePrecedence(inputs, scopeKey);
    expect(resolvePreferencePrecedence([...inputs].reverse(), scopeKey)).toEqual(forward);
    expect(inputs).toEqual(before);
    expect(forward.status).toBe('resolved');
    expect(forward.selected.map((item) => item.id)).toEqual(['A', 'z']);
  });
  it('returns an explicit empty result for an absent decision scope', () => {
    expect(resolvePreferencePrecedence([], scopeKey)).toEqual({ status: 'empty', scopeKey, selected: [] });
    expect(resolvePreferencePrecedence([candidate('a', 'currentInstruction', 'prefer', 'other')], scopeKey))
      .toEqual({ status: 'empty', scopeKey, selected: [] });
  });
  it('rejects missing decision scope, unknown authority, and duplicate candidate IDs', () => {
    expect(() => resolvePreferencePrecedence([], ' ')).toThrow(RangeError);
    expect(() => comparePreferencePrecedence('unknown' as PreferencePrecedenceSource, 'explicitPersistent'))
      .toThrow(RangeError);
    expect(() => resolvePreferencePrecedence([candidate('a', 'unknown' as PreferencePrecedenceSource)], scopeKey))
      .toThrow(RangeError);
    expect(() => resolvePreferencePrecedence([
      candidate('duplicate', 'explicitPersistent'), candidate('duplicate', 'explicitPersistent', 'avoid'),
    ], scopeKey)).toThrow(RangeError);
  });
});
