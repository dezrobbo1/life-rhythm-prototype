import type { Table } from 'dexie';
import {
  successfulCollectionRead,
  type CollectionReadResult,
} from './collectionReadResult';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import { rhythmTemplateSchema, type RhythmTemplate } from './schemas';

type RhythmTemplatesTable = Pick<Table<RhythmTemplate, string>, 'get' | 'put' | 'toArray'>;

export type LibraryRhythmStore = {
  rhythmTemplates: RhythmTemplatesTable;
};

export type LibraryRhythmWriteResult =
  | {
      ok: true;
      rhythm: RhythmTemplate;
    }
  | {
      errors: string[];
      ok: false;
    };

function issuesToMessages(issues: Array<{ message: string; path: Array<string | number> }>) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'rhythm';

    return `${path}: ${issue.message}`;
  });
}

function disablePersistedEnablement(rhythm: RhythmTemplate): RhythmTemplate {
  return {
    ...rhythm,
    enabled: false,
  };
}

function validateCustomRhythm(input: unknown): LibraryRhythmWriteResult {
  const parsed = rhythmTemplateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      errors: issuesToMessages(parsed.error.issues),
      ok: false,
    };
  }

  if (parsed.data.source !== 'custom') {
    return {
      errors: ['source: Only user-created custom Library rhythms can be saved.'],
      ok: false,
    };
  }

  return {
    ok: true,
    rhythm: disablePersistedEnablement(parsed.data),
  };
}

export async function loadCustomLibraryRhythms(
  store: LibraryRhythmStore = getCurrentLifeRhythmDatabase(),
): Promise<CollectionReadResult<RhythmTemplate>> {
  try {
    const stored = await store.rhythmTemplates.toArray();
    const rhythms: RhythmTemplate[] = [];
    let invalidRecordCount = 0;

    stored.forEach((rhythm) => {
      const parsed = rhythmTemplateSchema.safeParse(rhythm);

      if (!parsed.success) {
        invalidRecordCount += 1;
        return;
      }

      if (parsed.data.source !== 'custom') return;

      rhythms.push(disablePersistedEnablement(parsed.data));
    });

    return successfulCollectionRead(rhythms, invalidRecordCount);
  } catch {
    return {
      errors: ['rhythmTemplates: Saved custom Library rhythms could not be read.'],
      status: 'readFailed',
    };
  }
}

export async function saveCustomLibraryRhythm(
  input: unknown,
  store: LibraryRhythmStore = getCurrentLifeRhythmDatabase(),
): Promise<LibraryRhythmWriteResult> {
  const validated = validateCustomRhythm(input);

  if (!validated.ok) {
    return validated;
  }

  const existing = await store.rhythmTemplates.get(validated.rhythm.id);

  if (existing) {
    return {
      errors: ['id: A Library rhythm with this ID already exists.'],
      ok: false,
    };
  }

  await store.rhythmTemplates.put(validated.rhythm);

  return validated;
}
