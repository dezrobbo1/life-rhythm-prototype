import { describe, expect, it } from 'vitest';
import {
  comparePreferencePrecedence,
  preferencePrecedence,
  resolvePreferencePrecedence,
} from './preferencePrecedence';

describe('Gate 7C preference precedence', () => {
  it('encodes the documented preference hierarchy exactly', () => {
    expect(preferencePrecedence).toEqual([
      'currentInstruction',
      'explicitPersistent',
      'personallyTestedRule',
      'strongRepeatedAssociation',
      'weakAssociation',
      'populationInformedDefault',
    ]);

    for (let index = 0; index < preferencePrecedence.length - 1; index += 1) {
      expect(
        comparePreferencePrecedence(
          preferencePrecedence[index],
          preferencePrecedence[index + 1],
        ),
      ).toBeLessThan(0);
    }
  });

  it('lets a current explicit instruction outrank a conflicting persistent preference', () => {
    const result = resolvePreferencePrecedence([
      {
        id: 'persistent',
        source: 'explicitPersistent',
        relation: 'prefer',
      },
      {
        id: 'current',
        source: 'currentInstruction',
        relation: 'avoid',
      },
      {
        id: 'learned',
        source: 'strongRepeatedAssociation',
        relation: 'prefer',
      },
    ]);

    expect(result).toEqual({
      status: 'resolved',
      source: 'currentInstruction',
      selected: [
        {
          id: 'current',
          source: 'currentInstruction',
          relation: 'avoid',
        },
      ],
    });
  });

  it('lets persistent explicit preference outrank learned and default candidates', () => {
    const result = resolvePreferencePrecedence([
      {
        id: 'default',
        source: 'populationInformedDefault',
        relation: 'prefer',
      },
      {
        id: 'weak',
        source: 'weakAssociation',
        relation: 'prefer',
      },
      {
        id: 'strong',
        source: 'strongRepeatedAssociation',
        relation: 'avoid',
      },
      {
        id: 'explicit',
        source: 'explicitPersistent',
        relation: 'prefer',
      },
    ]);

    expect(result.status).toBe('resolved');
    if (result.status === 'empty') return;
    expect(result.source).toBe('explicitPersistent');
    expect(result.selected.map((candidate) => candidate.id)).toEqual(['explicit']);
  });

  it('does not silently resolve equal-precedence contradictions', () => {
    const result = resolvePreferencePrecedence([
      {
        id: 'prefer-morning',
        source: 'explicitPersistent',
        relation: 'prefer',
      },
      {
        id: 'avoid-morning',
        source: 'explicitPersistent',
        relation: 'avoid',
      },
      {
        id: 'learned',
        source: 'strongRepeatedAssociation',
        relation: 'prefer',
      },
    ]);

    expect(result).toEqual({
      status: 'conflict',
      source: 'explicitPersistent',
      selected: [
        {
          id: 'avoid-morning',
          source: 'explicitPersistent',
          relation: 'avoid',
        },
        {
          id: 'prefer-morning',
          source: 'explicitPersistent',
          relation: 'prefer',
        },
      ],
    });
  });

  it('returns an explicit empty result when no candidate exists', () => {
    expect(resolvePreferencePrecedence([])).toEqual({
      status: 'empty',
      selected: [],
    });
  });
});
