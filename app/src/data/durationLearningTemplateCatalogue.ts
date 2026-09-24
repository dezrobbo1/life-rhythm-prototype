import type { LifeRhythmDatabase } from './db';
import { getCurrentLifeRhythmDatabase } from './localDataNamespace';
import { rhythmTemplateSchema } from './schemas';

export type DurationLearningTemplateOption = {
  templateId: string;
  title: string;
  savedNormalMinutes: number;
};

export type DurationLearningTemplateCatalogueResult =
  | {
      status: 'ok';
      templates: DurationLearningTemplateOption[];
      warnings: string[];
    }
  | { status: 'readFailed'; errors: string[] };

export async function loadDurationLearningTemplateCatalogue(
  database: LifeRhythmDatabase = getCurrentLifeRhythmDatabase(),
): Promise<DurationLearningTemplateCatalogueResult> {
  try {
    const rows = await database.rhythmTemplates.toArray();
    const parsed = rows.map((row) => rhythmTemplateSchema.safeParse(row));
    const templates = parsed
      .flatMap((result) => result.success ? [result.data] : [])
      .map((template) => ({
        templateId: template.id,
        title: template.title,
        savedNormalMinutes: template.normal.minutes,
      }))
      .sort((left, right) =>
        left.title.localeCompare(right.title) ||
        left.templateId.localeCompare(right.templateId));
    const invalidCount = parsed.filter((result) => !result.success).length;
    return {
      status: 'ok',
      templates,
      warnings: invalidCount > 0
        ? [
            `Duration learning skipped ${invalidCount} malformed template record${invalidCount === 1 ? '' : 's'}.`,
          ]
        : [],
    };
  } catch {
    return {
      status: 'readFailed',
      errors: ['durationLearning: Template names could not be read on this device.'],
    };
  }
}
