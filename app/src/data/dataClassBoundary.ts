/**
 * Keys that belong to another local data class and must never appear inside a
 * settings record, a settings backup, or a settings import.
 *
 * The same list guards stored rows and imported files so a malformed or newer
 * row cannot smuggle task, rhythm, placement, scheduler or telemetry content
 * through a forward-compatible passthrough.
 */
export const blockedDataClassKeys = new Set([
  'activeTasks',
  'analytics',
  'calendar',
  'calendarData',
  'calendarSources',
  'devTickets',
  'futureModules',
  'imports',
  'legacy',
  'legacyData',
  'legacyLocalStorage',
  'libraryEnablement',
  'lifeRhythmPrototype13',
  'lifeRhythm_v140',
  'lifeRhythm_v143',
  'lifeRhythm_v146',
  'migrationLog',
  'migrations',
  'oneOff',
  'oneOffs',
  'quickPacks',
  'resetLog',
  'resetLogs',
  'rhythmTemplates',
  'rhythmInstances',
  'rhythmPlans',
  'rhythms',
  'schedulerOutput',
  'schedulerPlan',
  'schedulerPlans',
  'schedulerPlanState',
  'schedulerState',
  'softPlacements',
  'placements',
  'taskPoolItems',
  'tasks',
  'telemetry',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns the dotted path of the first cross-data-class key found anywhere in
 * `value`, or `undefined` when the value is clean.
 */
export function findBlockedDataClassKey(
  value: unknown,
  path: Array<string | number> = [],
): string | undefined {
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) {
      const nestedPath = findBlockedDataClassKey(child, [...path, index]);

      if (nestedPath) {
        return nestedPath;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];

    if (blockedDataClassKeys.has(key)) {
      return nextPath.join('.');
    }

    const nestedPath = findBlockedDataClassKey(child, nextPath);

    if (nestedPath) {
      return nestedPath;
    }
  }

  return undefined;
}
