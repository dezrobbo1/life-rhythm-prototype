import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { createLifeRhythmDatabase, DATABASE_VERSION } from '../data/db';
import { exportPortableProfile } from '../data/portableProfileBackup';
import { createDefaultSettings } from '../data/settingsRepository';
it('keeps portable exports device-only with no account session/config metadata', async () => {
  const db = createLifeRhythmDatabase('c1-synthetic-export');
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  try {
    await db.open();
    await db.settings.put(createDefaultSettings('2026-10-05T00:00:00.000Z'));
    const result = await exportPortableProfile(db, '2026-10-05T00:00:00.000Z');
    expect(result.payload.formatVersion).toBe(1);
    const json = result.json;
    for (const marker of [
      'Authorization',
      'Bearer',
      'sessionId',
      'publishableKey',
      'supabase',
      'privateKey',
      'account_heads',
      'trial_access',
    ])
      expect(json).not.toContain(marker);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(DATABASE_VERSION).toBe(6);
  } finally {
    fetchSpy.mockRestore();
    await db.delete();
  }
});
