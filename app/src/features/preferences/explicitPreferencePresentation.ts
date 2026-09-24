import type { ExplicitPreference } from '../../data/explicitPreferenceSchema';
import {
  explicitPreferenceTargetLabel,
  type ExplicitPreferenceTargetCatalog,
} from '../../data/explicitPreferenceTargetCatalog';

function relationLabel(relation: ExplicitPreference['relation']) {
  return relation === 'prefer' ? 'Prefer' : 'Avoid';
}

function dayLabel(days: readonly string[]) {
  return days.length === 0 ? 'Every day' : days.join(', ');
}

function timeLabel(preference: Pick<ExplicitPreference, 'start' | 'end'>) {
  return preference.start && preference.end
    ? `${preference.start}–${preference.end}`
    : 'Any time';
}

export function explicitPreferenceSummary(
  preference: ExplicitPreference,
  catalog: ExplicitPreferenceTargetCatalog,
): string {
  const target = explicitPreferenceTargetLabel(
    catalog,
    preference.targetKind,
    preference.targetValue,
  );
  return `${relationLabel(preference.relation)} ${target} · ${dayLabel(preference.days)} · ${timeLabel(preference)}`;
}

export function explicitPreferenceExpiryLabel(
  preference: Pick<ExplicitPreference, 'expiresAt'>,
  now = new Date(),
): string | null {
  if (!preference.expiresAt) return null;
  const date = new Date(preference.expiresAt);
  const expired = date.getTime() <= now.getTime();
  return `${expired ? 'Expired' : 'Expires'} ${date.toLocaleString()}`;
}

export function placementWhyLines(provenance: readonly string[]): string[] {
  const reasons: string[] = [];
  const add = (reason: string) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  for (const fact of provenance) {
    const variant = /^Used the (minimum|normal|full) form \((\d+) minutes\)\.$/.exec(fact);
    if (variant) {
      add(`The ${variant[1]} version (${variant[2]} min) fit here.`);
      continue;
    }
    if (fact.startsWith('Matched explicit preference ')) {
      add('A saved scheduling preference matched this time.');
      continue;
    }
    if (fact.startsWith('Conflicting preference guidance was not used')) {
      add('Some saved preferences disagreed, so they did not decide this time.');
      continue;
    }
    if (fact.startsWith('Placed inside candidate interval ')) {
      add('This sits inside usable planning space while fixed and protected boundaries stay clear.');
      continue;
    }
    if (fact.startsWith('Respected the fixedAt timing constraint.')) {
      add('This task has an exact timing requirement.');
      continue;
    }
    if (fact.startsWith('Respected the dueBy timing constraint.')) {
      add('This keeps the task inside its due-by timing boundary.');
      continue;
    }
    if (fact.startsWith('Respected the expiresAfter timing constraint.')) {
      add('This keeps the task inside its useful timing boundary.');
      continue;
    }
    if (fact === 'Minimum Done was used only after no valid normal-sized placement fit.') {
      add('The minimum version was used because the normal version did not fit safely.');
      continue;
    }
    if (fact === 'Used a preferred rhythm day when feasible.') {
      add('This uses one of the rhythm’s preferred days.');
      continue;
    }
    if (fact.startsWith('Matched the rhythm preferred time:')) {
      add('This matches the rhythm’s preferred time when feasible.');
      continue;
    }
    if (fact.startsWith('Scheduled occurrence ')) {
      add('This contributes to the current rhythm frequency.');
    }
  }

  if (reasons.length === 0) {
    add('This placement is part of the current valid private plan.');
  }

  return reasons.slice(0, 4);
}
