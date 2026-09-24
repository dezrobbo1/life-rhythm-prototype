import { describe, expect, it } from 'vitest';
import { placementReasonLines } from './placementExplanation';

describe('Gate 7D2 placement explanation presentation', () => {
  it('turns scheduler provenance into short user-facing reasons without exposing internal IDs', () => {
    const reasons = placementReasonLines([
      'Automatically placed by the deterministic Gate 3 scheduler.',
      'Used the normal form (20 minutes).',
      'Placed inside candidate interval candidate:2026-09-25:0900; hard and protected constraints remained authoritative.',
      'Matched explicit Prefer guidance preference:internal-id: Persisted explicit preference preference:internal-id; user-declared.',
    ]);

    expect(reasons).toEqual([
      'Life Rhythm placed this flexible item automatically.',
      'The normal version fits here (20 minutes).',
      'This sits inside time Life Rhythm can use while keeping hard and protected boundaries clear.',
      'A saved Prefer preference favored this time.',
    ]);
    expect(reasons.join(' ')).not.toContain('candidate:');
    expect(reasons.join(' ')).not.toContain('preference:internal-id');
  });

  it('describes an Avoid overlap without implying that the preference favored the selected time', () => {
    const reasons = placementReasonLines([
      'Overlapped explicit Avoid guidance preference:internal-avoid: Persisted explicit preference preference:internal-avoid; user-declared.',
    ]);

    expect(reasons).toEqual([
      'This time overlaps a saved Avoid preference, so that preference did not favor this placement.',
    ]);
    expect(reasons.join(' ')).not.toContain('internal-avoid');
  });

  it('explains a preference conflict without choosing a side or exposing IDs', () => {
    const reasons = placementReasonLines([
      'Conflicting preference guidance was not used to rank this slot: prefer-10, avoid-10.',
    ]);

    expect(reasons).toEqual([
      'Saved preferences conflict at this time, so neither side was used to choose it.',
    ]);
    expect(reasons.join(' ')).not.toContain('prefer-10');
  });
});
