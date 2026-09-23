export const preferencePrecedence = [
  'currentInstruction',
  'explicitPersistent',
  'personallyTestedRule',
  'strongRepeatedAssociation',
  'weakAssociation',
  'populationInformedDefault',
] as const;

export type PreferencePrecedenceSource = (typeof preferencePrecedence)[number];

export type PreferencePrecedenceCandidate = {
  id: string;
  source: PreferencePrecedenceSource;
  relation: 'prefer' | 'avoid';
};

export type PreferencePrecedenceResolution =
  | {
      status: 'empty';
      selected: [];
    }
  | {
      status: 'resolved' | 'conflict';
      source: PreferencePrecedenceSource;
      selected: PreferencePrecedenceCandidate[];
    };

const precedenceRank = new Map(
  preferencePrecedence.map((source, index) => [source, index]),
);

export function comparePreferencePrecedence(
  left: PreferencePrecedenceSource,
  right: PreferencePrecedenceSource,
) {
  return (precedenceRank.get(left) ?? Number.MAX_SAFE_INTEGER) -
    (precedenceRank.get(right) ?? Number.MAX_SAFE_INTEGER);
}

/**
 * Returns every candidate at the highest available precedence level.
 *
 * Equal-precedence contradictions are deliberately not broken by ID, arrival
 * order, confidence, or an inferred rule. Callers can surface or otherwise
 * handle that ambiguity without silently overriding the user.
 */
export function resolvePreferencePrecedence(
  candidates: readonly PreferencePrecedenceCandidate[],
): PreferencePrecedenceResolution {
  if (candidates.length === 0) {
    return { status: 'empty', selected: [] };
  }

  const ordered = [...candidates].sort(
    (left, right) =>
      comparePreferencePrecedence(left.source, right.source) ||
      left.id.localeCompare(right.id),
  );
  const source = ordered[0].source;
  const selected = ordered.filter((candidate) => candidate.source === source);
  const relations = new Set(selected.map((candidate) => candidate.relation));

  return {
    status: relations.size > 1 ? 'conflict' : 'resolved',
    source,
    selected,
  };
}
