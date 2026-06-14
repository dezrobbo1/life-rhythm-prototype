import { type AppExport, appExportSchema } from './schemas';

export type ImportValidationResult =
  | {
      ok: true;
      data: AppExport;
    }
  | {
      ok: false;
      errors: string[];
    };

export function validateImportData(input: unknown): ImportValidationResult {
  const result = appExportSchema.safeParse(input);

  if (result.success) {
    return {
      ok: true,
      data: result.data,
    };
  }

  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    }),
  };
}

export function parseImportJson(json: string): ImportValidationResult {
  try {
    return validateImportData(JSON.parse(json) as unknown);
  } catch {
    return {
      ok: false,
      errors: ['root: Import file is not valid JSON.'],
    };
  }
}

export function serializeExport(data: AppExport): string {
  return JSON.stringify(appExportSchema.parse(data), null, 2);
}

