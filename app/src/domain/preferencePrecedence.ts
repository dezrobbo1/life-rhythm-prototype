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
  /** A concrete comparable decision, including target and applicable time/context. */
  scopeKey: string;
  source: PreferencePrecedenceSource;
  relation: 'prefer' | 'avoid';
};
export type PreferencePrecedenceResolution =
  | { status: 'empty'; scopeKey: string; selected: [] }
  | {
      status: 'resolved' | 'conflict';
      scopeKey: string;
      source: PreferencePrecedenceSource;
      selected: PreferencePrecedenceCandidate[];
    };

export function comparePreferencePrecedence(
  left: PreferencePrecedenceSource, right: PreferencePrecedenceSource,
) {
  const leftRank = preferencePrecedence.indexOf(left);
  const rightRank = preferencePrecedence.indexOf(right);
  if (leftRank < 0 || rightRank < 0) throw new RangeError('Unknown preference source.');
  return leftRank - rightRank;
}

/**
 * Selects authority for ONE already-scoped decision, not across unrelated rules.
 * Callers establish target/window applicability first. Hard constraints remain
 * outside this hierarchy. Equal-rank contradictions are returned, never guessed.
 */
export function resolvePreferencePrecedence(
  candidates: readonly PreferencePrecedenceCandidate[], scopeKey: string,
): PreferencePrecedenceResolution {
  if (!scopeKey.trim()) throw new RangeError('A nonblank decision scope is required.');
  const applicable = candidates.filter((candidate) => candidate.scopeKey === scopeKey);
  const seen = new Set<string>();
  for (const candidate of applicable) {
    comparePreferencePrecedence(candidate.source, candidate.source);
    if (!candidate.id.trim() || seen.has(candidate.id) ||
        (candidate.relation !== 'prefer' && candidate.relation !== 'avoid')) {
      throw new RangeError('Invalid or duplicate preference candidate.');
    }
    seen.add(candidate.id);
  }
  if (applicable.length === 0) return { status: 'empty', scopeKey, selected: [] };
  const ordered = [...applicable].sort((left, right) =>
    comparePreferencePrecedence(left.source, right.source) ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
  const source = ordered[0].source;
  const selected = ordered.filter((candidate) => candidate.source === source).map((candidate) => ({ ...candidate }));
  return {
    status: new Set(selected.map((candidate) => candidate.relation)).size > 1 ? 'conflict' : 'resolved',
    scopeKey, source, selected,
  };
}
