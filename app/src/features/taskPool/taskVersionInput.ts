import type { TaskPoolItem } from '../../data/schemas';

type TaskVersion = TaskPoolItem['minimum'];

export type TaskVersionInput = {
  minimumVersion: string;
  minimumMinutes: string;
  normalVersion: string;
  normalMinutes: string;
  fullVersion: string;
  fullMinutes: string;
};

export type ResolvedTaskVersions = {
  minimum: TaskVersion;
  normal: TaskVersion;
  full: TaskVersion;
};

/** Empty optional pairs inherit the preceding action AND its exact duration. */
export function resolveTaskVersions(input: TaskVersionInput):
  | { ok: true; versions: ResolvedTaskVersions }
  | { ok: false; error: string } {
  const parse = (kind: 'Minimum' | 'Normal' | 'Full', label: string, rawMinutes: string):
    | { ok: true; version: TaskVersion }
    | { ok: false; error: string } => {
    if (!label.trim()) return { ok: false, error: `${kind} action is required when entering its duration.` };
    if (!/^[1-9][0-9]*$/.test(rawMinutes.trim())) {
      return { ok: false, error: `${kind} minutes must be a positive whole number.` };
    }
    const minutes = Number(rawMinutes.trim());
    if (!Number.isSafeInteger(minutes)) {
      return { ok: false, error: `${kind} minutes must be a positive whole number.` };
    }
    return { ok: true, version: { label: label.trim(), minutes } };
  };

  const minimum = parse('Minimum', input.minimumVersion, input.minimumMinutes);
  if (!minimum.ok) return minimum;

  const optional = (
    kind: 'Normal' | 'Full', label: string, minutes: string, previous: TaskVersion,
  ) => !label.trim() && !minutes.trim()
    ? { ok: true as const, version: { ...previous } }
    : parse(kind, label, minutes);

  const normal = optional('Normal', input.normalVersion, input.normalMinutes, minimum.version);
  if (!normal.ok) return normal;
  const full = optional('Full', input.fullVersion, input.fullMinutes, normal.version);
  if (!full.ok) return full;
  return { ok: true, versions: { minimum: minimum.version, normal: normal.version, full: full.version } };
}
