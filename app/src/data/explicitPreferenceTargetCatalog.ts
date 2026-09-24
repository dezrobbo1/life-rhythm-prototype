import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import {
  activeTaskSchema,
  areaSchema,
  rhythmTemplateSchema,
  taskPoolItemSchema,
  taskTypeSchema,
} from './schemas';
import type { LifeRhythmDatabase } from './db';

export type ExplicitPreferenceTargetKind = 'intention' | 'rhythm' | 'area' | 'taskType';

export type ExplicitPreferenceTargetOption = {
  kind: ExplicitPreferenceTargetKind;
  value: string;
  label: string;
};

export type ExplicitPreferenceTargetCatalog = {
  tasks: ExplicitPreferenceTargetOption[];
  rhythms: ExplicitPreferenceTargetOption[];
  areas: ExplicitPreferenceTargetOption[];
  taskTypes: ExplicitPreferenceTargetOption[];
};

export type ExplicitPreferenceTargetCatalogResult =
  | ({
      status: 'ok' | 'partial';
      invalidRecordCount: number;
    } & ExplicitPreferenceTargetCatalog)
  | ({
      status: 'readFailed';
      errors: string[];
    } & ExplicitPreferenceTargetCatalog);

const areaLabels: Record<(typeof areaSchema.options)[number], string> = {
  house: 'House',
  food: 'Food',
  movement: 'Movement',
  work: 'Work',
  money: 'Money',
  antidrift: 'Anti-drift',
  sensory: 'Sensory',
  emotion: 'Emotional',
  social: 'Social',
  health: 'Health',
  admin: 'Admin',
  other: 'Other',
};

const taskTypeLabels: Record<(typeof taskTypeSchema.options)[number], string> = {
  simple: 'Simple task',
  house: 'House task',
  admin: 'Admin task',
  work: 'Work task',
  food: 'Food task',
  exercise: 'Exercise',
  leaving: 'Leaving / travel',
  kids: 'Kids',
  avoided: 'Often avoided',
  sensory: 'Sensory',
  emotion: 'Emotional',
  social: 'Social',
};

function ordered(options: ExplicitPreferenceTargetOption[]) {
  return [...options].sort((left, right) =>
    left.label.localeCompare(right.label) || left.value.localeCompare(right.value),
  );
}

function staticCatalog(): Pick<ExplicitPreferenceTargetCatalog, 'areas' | 'taskTypes'> {
  return {
    areas: areaSchema.options.map((value) => ({
      kind: 'area' as const,
      value,
      label: areaLabels[value],
    })),
    taskTypes: taskTypeSchema.options.map((value) => ({
      kind: 'taskType' as const,
      value,
      label: taskTypeLabels[value],
    })),
  };
}

export function emptyExplicitPreferenceTargetCatalog(): ExplicitPreferenceTargetCatalog {
  return {
    tasks: [],
    rhythms: [],
    ...staticCatalog(),
  };
}

export function targetOptionsForKind(
  catalog: ExplicitPreferenceTargetCatalog,
  kind: ExplicitPreferenceTargetKind,
): ExplicitPreferenceTargetOption[] {
  switch (kind) {
    case 'intention':
      return catalog.tasks;
    case 'rhythm':
      return catalog.rhythms;
    case 'area':
      return catalog.areas;
    case 'taskType':
      return catalog.taskTypes;
  }
}

export function explicitPreferenceTargetLabel(
  catalog: ExplicitPreferenceTargetCatalog,
  kind: ExplicitPreferenceTargetKind,
  value: string,
): string {
  return targetOptionsForKind(catalog, kind).find((option) => option.value === value)?.label ??
    (kind === 'intention'
      ? 'Unavailable saved task'
      : kind === 'rhythm'
        ? 'Unavailable saved rhythm'
        : 'Unavailable saved target');
}

export async function loadExplicitPreferenceTargetCatalog(
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<ExplicitPreferenceTargetCatalogResult> {
  const fallback = emptyExplicitPreferenceTargetCatalog();

  try {
    const [activeRows, poolRows, rhythmRows] = await database.transaction(
      'r',
      [database.activeTasks, database.taskPoolItems, database.rhythmTemplates],
      async () => Promise.all([
        database.activeTasks.toArray(),
        database.taskPoolItems.toArray(),
        database.rhythmTemplates.toArray(),
      ]),
    );

    let invalidRecordCount = 0;
    const tasks = new Map<string, ExplicitPreferenceTargetOption>();
    const rhythms = new Map<string, ExplicitPreferenceTargetOption>();

    for (const row of activeRows) {
      const parsed = activeTaskSchema.safeParse(row);
      if (!parsed.success) {
        invalidRecordCount += 1;
        continue;
      }
      if (parsed.data.status === 'done') continue;
      tasks.set(parsed.data.id, {
        kind: 'intention',
        value: parsed.data.id,
        label: parsed.data.title,
      });
    }

    for (const row of poolRows) {
      const parsed = taskPoolItemSchema.safeParse(row);
      if (!parsed.success) {
        invalidRecordCount += 1;
        continue;
      }
      if (parsed.data.status === 'noLongerNeeded') continue;
      if (!tasks.has(parsed.data.id)) {
        tasks.set(parsed.data.id, {
          kind: 'intention',
          value: parsed.data.id,
          label: parsed.data.title,
        });
      }
    }

    for (const row of rhythmRows) {
      const parsed = rhythmTemplateSchema.safeParse(row);
      if (!parsed.success) {
        invalidRecordCount += 1;
        continue;
      }
      if (parsed.data.archivedAt) continue;
      const canonicalRhythmId = `rhythm:${parsed.data.id}`;
      rhythms.set(canonicalRhythmId, {
        kind: 'rhythm',
        value: canonicalRhythmId,
        label: parsed.data.title,
      });
    }

    return {
      status: invalidRecordCount > 0 ? 'partial' : 'ok',
      invalidRecordCount,
      tasks: ordered([...tasks.values()]),
      rhythms: ordered([...rhythms.values()]),
      ...staticCatalog(),
    };
  } catch {
    return {
      status: 'readFailed',
      errors: ['preferenceTargets: Saved tasks and rhythms could not be read.'],
      ...fallback,
    };
  }
}
