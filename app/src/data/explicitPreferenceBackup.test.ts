import { describe, expect, it, vi } from 'vitest';
import {
  EXPLICIT_PREFERENCE_BACKUP_KIND,
  exportExplicitPreferenceBackup,
} from './explicitPreferenceBackup';

describe('Gate 7D2 explicit preference backup', () => {
  it('wraps the raw sidecar without requiring it to be valid scheduling authority', async () => {
    const rawRecord = { id: 'preferences:explicit:v1', malformed: { keep: true } };
    const result = await exportExplicitPreferenceBackup(
      '2026-09-24T12:00:00.000Z',
      vi.fn().mockResolvedValue({ status: 'ok', rawRecord }),
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.fileName).toBe('life-rhythm-scheduling-preferences-2026-09-24.json');
    expect(result.payload).toEqual({
      kind: EXPLICIT_PREFERENCE_BACKUP_KIND,
      version: 1,
      exportedAt: '2026-09-24T12:00:00.000Z',
      rawRecord,
    });
    expect(JSON.parse(result.json).rawRecord).toEqual(rawRecord);
  });

  it('preserves missing and read-failure states instead of manufacturing an empty backup', async () => {
    expect(await exportExplicitPreferenceBackup(
      '2026-09-24T12:00:00.000Z',
      vi.fn().mockResolvedValue({ status: 'missing' }),
    )).toEqual({ status: 'missing' });

    expect(await exportExplicitPreferenceBackup(
      '2026-09-24T12:00:00.000Z',
      vi.fn().mockResolvedValue({
        status: 'readFailed',
        errors: ['explicitPreferences: Preferences could not be exported.'],
      }),
    )).toEqual({
      status: 'readFailed',
      errors: ['explicitPreferences: Preferences could not be exported.'],
    });
  });
});
