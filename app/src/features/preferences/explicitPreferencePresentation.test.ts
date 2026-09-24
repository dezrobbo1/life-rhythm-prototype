import { describe, expect, it } from 'vitest';
import { placementWhyLines } from './explicitPreferencePresentation';

describe('Gate 7D2 placement explanation presentation', () => {
  it('turns internal provenance into short grounded reasons without exposing internal IDs', () => {
    const lines = placementWhyLines([
      'Automatically placed by the deterministic Gate 3 scheduler.',
      'Used the normal form (20 minutes).',
      'Placed inside candidate interval candidate-secret-id; hard and protected constraints remained authoritative.',
      'Matched user-declared preference: prefer admin area on Monday from 11:00 to 12:00.',
    ]);

    expect(lines).toContain('The normal version (20 min) fit here.');
    expect(lines).toContain('This sits inside usable planning space while fixed and protected boundaries stay clear.');
    expect(lines).toContain('Saved preference matched: prefer admin area on Monday from 11:00 to 12:00.');
    expect(lines.join(' ')).not.toContain('candidate-secret-id');
    expect(lines.join(' ')).not.toContain('preference-secret-id');
  });

  it('keeps contradictory preferences visible without pretending one won', () => {
    expect(placementWhyLines([
      'Conflicting preference guidance was not used to rank this slot.',
    ])).toEqual([
      'Some saved preferences disagreed, so they did not decide this time.',
    ]);
  });
});
