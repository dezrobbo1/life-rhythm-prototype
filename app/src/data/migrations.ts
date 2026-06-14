export const LEGACY_V146_KEY = 'lifeRhythm_v146';

type StorageReader = Pick<Storage, 'getItem'>;

type LegacyObject = Record<string, unknown>;

export type LegacyInspection =
  | {
      found: false;
      key: typeof LEGACY_V146_KEY;
      readOnly: true;
      warnings: string[];
    }
  | {
      found: true;
      key: typeof LEGACY_V146_KEY;
      parsed: false;
      rawLength: number;
      readOnly: true;
      warnings: string[];
    }
  | {
      found: true;
      key: typeof LEGACY_V146_KEY;
      parsed: true;
      rawLength: number;
      readOnly: true;
      topLevelKeys: string[];
      version?: string;
      counts: LegacyCandidateCounts;
      warnings: string[];
    };

export type LegacyCandidateCounts = {
  settings: number;
  rhythmTemplates: number;
  activeTasks: number;
  taskHistory: number;
  completionLogs: number;
  resetLogs: number;
  startBoostLogs: number;
  devTickets: number;
};

export type MigrationPlan = {
  sourceKey: typeof LEGACY_V146_KEY;
  canPlan: boolean;
  willWrite: false;
  counts: LegacyCandidateCounts;
  steps: string[];
  warnings: string[];
};

const zeroCounts = (): LegacyCandidateCounts => ({
  settings: 0,
  rhythmTemplates: 0,
  activeTasks: 0,
  taskHistory: 0,
  completionLogs: 0,
  resetLogs: 0,
  startBoostLogs: 0,
  devTickets: 0,
});

const isRecord = (value: unknown): value is LegacyObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const arrayCount = (value: unknown) => (Array.isArray(value) ? value.length : 0);

const objectValueCount = (value: unknown) => (isRecord(value) ? Object.keys(value).length : 0);

function countLegacyCandidates(value: LegacyObject): LegacyCandidateCounts {
  const tasks = Array.isArray(value.tasks) ? value.tasks : [];
  const libraryTasks = tasks.filter((item) => isRecord(item) && item.library === true);
  const activeTasks = tasks.filter((item) => !isRecord(item) || item.library !== true);

  return {
    settings: isRecord(value.settings) ? 1 : 0,
    rhythmTemplates: libraryTasks.length,
    activeTasks: activeTasks.length,
    taskHistory: arrayCount(value.history) + arrayCount(value.timeSessions),
    completionLogs: arrayCount(value.history) + objectValueCount(value.completedToday),
    resetLogs: arrayCount(value.resetLog),
    startBoostLogs: arrayCount(value.startBoostLog),
    devTickets: arrayCount(value.devTickets),
  };
}

export function inspectLegacyV146(storage: StorageReader): LegacyInspection {
  const raw = storage.getItem(LEGACY_V146_KEY);

  if (raw === null) {
    return {
      found: false,
      key: LEGACY_V146_KEY,
      readOnly: true,
      warnings: ['No lifeRhythm_v146 key found.'],
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed)) {
      return {
        found: true,
        key: LEGACY_V146_KEY,
        parsed: false,
        rawLength: raw.length,
        readOnly: true,
        warnings: ['Legacy value parsed but was not an object.'],
      };
    }

    const warnings: string[] = [];
    if (parsed.version !== '1.4.6') {
      warnings.push('Legacy value did not report version 1.4.6.');
    }
    if (!Array.isArray(parsed.tasks)) {
      warnings.push('Legacy value has no tasks array.');
    }

    return {
      found: true,
      key: LEGACY_V146_KEY,
      parsed: true,
      rawLength: raw.length,
      readOnly: true,
      topLevelKeys: Object.keys(parsed).sort(),
      version: typeof parsed.version === 'string' ? parsed.version : undefined,
      counts: countLegacyCandidates(parsed),
      warnings,
    };
  } catch {
    return {
      found: true,
      key: LEGACY_V146_KEY,
      parsed: false,
      rawLength: raw.length,
      readOnly: true,
      warnings: ['Legacy value is not valid JSON.'],
    };
  }
}

export function planLegacyV146Migration(inspection: LegacyInspection): MigrationPlan {
  if (!inspection.found || !inspection.parsed) {
    return {
      sourceKey: LEGACY_V146_KEY,
      canPlan: false,
      willWrite: false,
      counts: zeroCounts(),
      steps: [],
      warnings: inspection.warnings,
    };
  }

  return {
    sourceKey: LEGACY_V146_KEY,
    canPlan: true,
    willWrite: false,
    counts: inspection.counts,
    steps: [
      'Validate legacy settings into the future settings schema.',
      'Split legacy library tasks into rhythm templates.',
      'Map non-library legacy tasks into active task candidates.',
      'Map completion/history/reset/Start Boost/dev ticket arrays into append-only logs.',
      'Write nothing until migration execution is approved in a later phase.',
    ],
    warnings: inspection.warnings,
  };
}

export function inspectAndPlanLegacyV146(storage: StorageReader) {
  const inspection = inspectLegacyV146(storage);
  return {
    inspection,
    plan: planLegacyV146Migration(inspection),
  };
}

