import type {
  ActiveTask,
  RhythmTemplate,
  Settings,
} from '../schemas';
import {
  emptyAppSnapshot,
  futureModulePlaceholders,
  type AppDataSnapshot,
  type HiddenEdgeKind,
  type HiddenEdgeViewModel,
  type QuickPackViewModel,
  type SafetySettingsViewModel,
  type SnapshotActiveTask,
  type SnapshotPlanBlock,
  type SnapshotResetAction,
  type SnapshotRhythmTemplate,
  type SnapshotSchedule,
  type SnapshotSettings,
  type SnapshotTaskVersion,
} from '../../viewModels';

type UnknownRecord = Record<string, unknown>;

export type ReadOnlyCurrentData = {
  settings?: Partial<Settings> | null;
  rhythmTemplates?: Array<Partial<RhythmTemplate>> | null;
  activeTasks?: Array<Partial<ActiveTask>> | null;
  quickPacks?: QuickPackViewModel[] | null;
  planBlocks?: SnapshotPlanBlock[] | null;
  resetActions?: SnapshotResetAction[] | null;
  futureModules?: AppDataSnapshot['futureModules'] | null;
};

export type LoadReadOnlyAppSnapshotInput = {
  currentData?: ReadOnlyCurrentData | null;
  legacySnapshot?: unknown;
  fallbackSnapshot?: AppDataSnapshot;
};

const areaLabels: Record<string, string> = {
  admin: 'Admin',
  antidrift: 'Anti-scroll',
  emotion: 'Emotional recovery',
  food: 'Food',
  health: 'Health',
  house: 'Household',
  money: 'Money',
  movement: 'Movement',
  other: 'Other',
  sensory: 'Sensory load',
  social: 'Social support',
  work: 'Work focus',
};

const themeNames = ['exhale', 'clear', 'grounded'] as const;
const activeTaskStatuses = [
  'active',
  'inProgress',
  'paused',
  'minimumDone',
  'done',
  'parked',
  'skipped',
  'notToday',
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return values.length > 0 ? values : undefined;
}

function themeValue(value: unknown): SnapshotSettings['theme'] | undefined {
  const theme = value as SnapshotSettings['theme'];

  return theme && themeNames.includes(theme)
    ? theme
    : undefined;
}

function areaLabel(value: unknown): string {
  const area = stringValue(value);

  if (!area) {
    return 'Other';
  }

  return areaLabels[area] ?? area;
}

function statusValue(value: unknown): SnapshotActiveTask['status'] | undefined {
  const status = value as SnapshotActiveTask['status'];

  return status && activeTaskStatuses.includes(status)
    ? status
    : undefined;
}

function versionFromUnknown(value: unknown, fallbackLabel: string): SnapshotTaskVersion {
  if (isRecord(value)) {
    return {
      label: stringValue(value.label) ?? stringValue(value.text) ?? stringValue(value.title) ?? fallbackLabel,
      minutes: numberValue(value.minutes),
    };
  }

  return {
    label: stringValue(value) ?? fallbackLabel,
  };
}

function scheduleFromRecord(record: UnknownRecord | undefined): SnapshotSchedule | undefined {
  if (!record) {
    return undefined;
  }

  const schedule = isRecord(record.schedule) ? record.schedule : record;
  const result: SnapshotSchedule = {
    cleanupMinutes: numberValue(schedule.cleanupMinutes),
    fixedTime: stringValue(schedule.fixedTime),
    frequency: numberValue(schedule.frequency),
    prepMinutes: numberValue(schedule.prepMinutes),
    preferredDays: stringArray(schedule.preferredDays),
    targetDate: stringValue(schedule.targetDate),
    transitionMinutes: numberValue(schedule.transitionMinutes),
    travelMinutes: numberValue(schedule.travelMinutes),
  };
  const hasValue = Object.values(result).some((value) => value !== undefined);

  return hasValue ? result : undefined;
}

function edgeFromMinutes(
  taskId: string,
  kind: HiddenEdgeKind,
  minutes: number | undefined,
  label: string,
): HiddenEdgeViewModel | null {
  if (!minutes || minutes <= 0) {
    return null;
  }

  return {
    id: `${taskId}-${kind.replace(/\s+/g, '-')}`,
    kind,
    label,
    range: `${minutes} min`,
  };
}

function hiddenEdgesFromSchedule(taskId: string, schedule: SnapshotSchedule | undefined): HiddenEdgeViewModel[] {
  return [
    edgeFromMinutes(taskId, 'prep', schedule?.prepMinutes, 'Prep before starting'),
    edgeFromMinutes(taskId, 'travel', schedule?.travelMinutes, 'Travel time'),
    edgeFromMinutes(taskId, 'cleanup', schedule?.cleanupMinutes, 'Cleanup after'),
    edgeFromMinutes(taskId, 'transition', schedule?.transitionMinutes, 'Transition margin'),
  ].filter((edge): edge is HiddenEdgeViewModel => edge !== null);
}

function settingsFromCurrent(settings: Partial<Settings> | null | undefined): SnapshotSettings | undefined {
  if (!settings) {
    return undefined;
  }

  return {
    lifeShape: settings.lifeShape as SnapshotSettings['lifeShape'] | undefined,
    startBoostSafety: settings.startBoostSafety as Partial<SafetySettingsViewModel> | undefined,
    theme: themeValue(settings.theme),
  };
}

function currentTaskToSnapshot(task: Partial<ActiveTask>, index: number): SnapshotActiveTask {
  const id = stringValue(task.id) ?? `current-task-${index + 1}`;
  const schedule = scheduleFromRecord(task as UnknownRecord);

  return {
    area: areaLabel(task.area),
    chips: stringArray((task as UnknownRecord).chips),
    full: versionFromUnknown(task.full, 'Full version is not set yet.'),
    hiddenEdges: hiddenEdgesFromSchedule(id, schedule),
    id,
    minimum: versionFromUnknown(task.minimum, 'Minimum version is not set yet.'),
    normal: versionFromUnknown(task.normal, 'Normal version is not set yet.'),
    purpose: stringValue(task.purpose),
    schedule,
    showToday: Boolean(task.showToday),
    source: task.source,
    status: statusValue(task.status),
    templateId: stringValue(task.templateId),
    title: stringValue(task.title) ?? 'Untitled task',
  };
}

function currentRhythmToSnapshot(template: Partial<RhythmTemplate>, index: number): SnapshotRhythmTemplate {
  return {
    area: areaLabel(template.area),
    category: areaLabel(template.area),
    chips: stringArray((template as UnknownRecord).chips),
    enabled: Boolean(template.enabled),
    full: versionFromUnknown(template.full, 'Full version is not set yet.'),
    id: stringValue(template.id) ?? `current-rhythm-${index + 1}`,
    minimum: versionFromUnknown(template.minimum, 'Minimum version is not set yet.'),
    normal: versionFromUnknown(template.normal, 'Normal version is not set yet.'),
    purpose: stringValue(template.purpose),
    schedule: scheduleFromRecord(template as UnknownRecord),
    title: stringValue(template.title) ?? 'Untitled rhythm',
  };
}

function cloneSnapshot(snapshot: AppDataSnapshot): AppDataSnapshot {
  return {
    activeTasks: snapshot.activeTasks?.map((task) => ({
      ...task,
      chips: task.chips ? [...task.chips] : undefined,
      hiddenEdges: task.hiddenEdges?.map((edge) => ({ ...edge })),
      schedule: task.schedule ? { ...task.schedule, preferredDays: task.schedule.preferredDays ? [...task.schedule.preferredDays] : undefined } : undefined,
    })),
    futureModules: snapshot.futureModules?.map((module) => ({ ...module })),
    planBlocks: snapshot.planBlocks?.map((block) => ({
      ...block,
      items: block.items?.map((item) => ({
        ...item,
        hiddenEdges: item.hiddenEdges.map((edge) => ({ ...edge })),
      })),
    })),
    quickPacks: snapshot.quickPacks?.map((pack) => ({
      ...pack,
      rhythmIds: [...pack.rhythmIds],
    })),
    resetActions: snapshot.resetActions?.map((action) => ({ ...action })),
    rhythmTemplates: snapshot.rhythmTemplates?.map((template) => ({
      ...template,
      chips: template.chips ? [...template.chips] : undefined,
      schedule: template.schedule ? { ...template.schedule, preferredDays: template.schedule.preferredDays ? [...template.schedule.preferredDays] : undefined } : undefined,
    })),
    settings: snapshot.settings
      ? {
          ...snapshot.settings,
          lifeShape: snapshot.settings.lifeShape
            ? {
                ...snapshot.settings.lifeShape,
                fixedCommitments: snapshot.settings.lifeShape.fixedCommitments.map((commitment) => ({
                  ...commitment,
                  days: [...commitment.days],
                })),
                mealAnchors: { ...snapshot.settings.lifeShape.mealAnchors },
                sleepWakeAnchors: { ...snapshot.settings.lifeShape.sleepWakeAnchors },
                usualWorkHours: {
                  ...snapshot.settings.lifeShape.usualWorkHours,
                  days: [...snapshot.settings.lifeShape.usualWorkHours.days],
                },
              }
            : undefined,
          startBoostSafety: snapshot.settings.startBoostSafety
            ? { ...snapshot.settings.startBoostSafety }
            : undefined,
        }
      : undefined,
    todayState: snapshot.todayState,
  };
}

function hasCurrentData(data: ReadOnlyCurrentData | null | undefined): data is ReadOnlyCurrentData {
  if (!data) {
    return false;
  }

  return Boolean(
    data.settings ||
      (data.activeTasks && data.activeTasks.length > 0) ||
      (data.rhythmTemplates && data.rhythmTemplates.length > 0) ||
      (data.quickPacks && data.quickPacks.length > 0) ||
      (data.planBlocks && data.planBlocks.length > 0) ||
      (data.resetActions && data.resetActions.length > 0) ||
      (data.futureModules && data.futureModules.length > 0),
  );
}

function hasSnapshotContent(snapshot: AppDataSnapshot): boolean {
  return Boolean(
    snapshot.settings ||
      (snapshot.activeTasks && snapshot.activeTasks.length > 0) ||
      (snapshot.rhythmTemplates && snapshot.rhythmTemplates.length > 0) ||
      (snapshot.quickPacks && snapshot.quickPacks.length > 0) ||
      (snapshot.planBlocks && snapshot.planBlocks.length > 0) ||
      (snapshot.resetActions && snapshot.resetActions.length > 0) ||
      (snapshot.futureModules && snapshot.futureModules.length > 0),
  );
}

export function getFallbackAppSnapshot(fallbackSnapshot: AppDataSnapshot = emptyAppSnapshot): AppDataSnapshot {
  return cloneSnapshot({
    ...fallbackSnapshot,
    futureModules: fallbackSnapshot.futureModules ?? futureModulePlaceholders,
  });
}

export function mapCurrentDataToAppSnapshot(currentData: ReadOnlyCurrentData = {}): AppDataSnapshot {
  return {
    activeTasks: (currentData.activeTasks ?? []).map(currentTaskToSnapshot),
    futureModules: currentData.futureModules ? [...currentData.futureModules] : undefined,
    planBlocks: currentData.planBlocks ? [...currentData.planBlocks] : undefined,
    quickPacks: currentData.quickPacks ? [...currentData.quickPacks] : undefined,
    resetActions: currentData.resetActions ? [...currentData.resetActions] : undefined,
    rhythmTemplates: (currentData.rhythmTemplates ?? []).map(currentRhythmToSnapshot),
    settings: settingsFromCurrent(currentData.settings),
  };
}

function legacyVersion(record: UnknownRecord, minimumKey: string, normalKey: string, fullKey: string) {
  return {
    full: versionFromUnknown(record[fullKey] ?? record.full ?? record.fullVersion, 'Full version is not set yet.'),
    minimum: versionFromUnknown(record[minimumKey] ?? record.minimum ?? record.minimumVersion, 'Minimum version is not set yet.'),
    normal: versionFromUnknown(record[normalKey] ?? record.normal ?? record.normalVersion, 'Normal version is not set yet.'),
  };
}

function legacyTaskId(record: UnknownRecord, prefix: string, index: number): string {
  return stringValue(record.id) ?? stringValue(record.uid) ?? `${prefix}-${index + 1}`;
}

function isLegacyLibraryRhythm(record: UnknownRecord): boolean {
  return record.library === true || record.source === 'library' || record.kind === 'repeating' || record.type === 'rhythm';
}

function legacyTaskToActiveTask(record: UnknownRecord, index: number): SnapshotActiveTask {
  const id = legacyTaskId(record, 'legacy-task', index);
  const schedule = scheduleFromRecord(record);
  const versions = legacyVersion(record, 'min', 'normal', 'full');

  return {
    area: areaLabel(record.area ?? record.category),
    chips: stringArray(record.chips),
    full: versions.full,
    hiddenEdges: hiddenEdgesFromSchedule(id, schedule),
    id,
    minimum: versions.minimum,
    normal: versions.normal,
    purpose: stringValue(record.purpose) ?? stringValue(record.note),
    schedule,
    showToday: Boolean(record.today ?? record.showToday),
    source: record.source === 'custom' ? 'custom' : 'adhoc',
    status: statusValue(record.status),
    templateId: stringValue(record.templateId),
    title: stringValue(record.title) ?? stringValue(record.name) ?? 'Untitled task',
  };
}

function legacyTaskToRhythm(record: UnknownRecord, index: number): SnapshotRhythmTemplate {
  const versions = legacyVersion(record, 'min', 'normal', 'full');

  return {
    area: areaLabel(record.area ?? record.category),
    category: areaLabel(record.category ?? record.area),
    chips: stringArray(record.chips),
    enabled: Boolean(record.enabled),
    full: versions.full,
    id: legacyTaskId(record, 'legacy-rhythm', index),
    minimum: versions.minimum,
    normal: versions.normal,
    purpose: stringValue(record.purpose) ?? stringValue(record.note),
    schedule: scheduleFromRecord(record),
    title: stringValue(record.title) ?? stringValue(record.name) ?? 'Untitled rhythm',
  };
}

export function mapLegacySnapshotToAppSnapshot(legacySnapshot: unknown): AppDataSnapshot {
  if (!isRecord(legacySnapshot)) {
    return {};
  }

  const tasks = Array.isArray(legacySnapshot.tasks) ? legacySnapshot.tasks.filter(isRecord) : [];
  const legacySettings = isRecord(legacySnapshot.settings) ? legacySnapshot.settings : undefined;

  return {
    activeTasks: tasks.filter((task) => !isLegacyLibraryRhythm(task)).map(legacyTaskToActiveTask),
    rhythmTemplates: tasks.filter(isLegacyLibraryRhythm).map(legacyTaskToRhythm),
    settings: legacySettings
      ? {
          theme: themeValue(legacySettings.theme),
        }
      : undefined,
  };
}

export function loadReadOnlyAppSnapshot(input: LoadReadOnlyAppSnapshotInput = {}): AppDataSnapshot {
  const fallback = getFallbackAppSnapshot(input.fallbackSnapshot);

  if (hasCurrentData(input.currentData)) {
    return mapCurrentDataToAppSnapshot(input.currentData);
  }

  if (input.legacySnapshot !== undefined) {
    const legacySnapshot = mapLegacySnapshotToAppSnapshot(input.legacySnapshot);
    return hasSnapshotContent(legacySnapshot) ? legacySnapshot : fallback;
  }

  return fallback;
}
