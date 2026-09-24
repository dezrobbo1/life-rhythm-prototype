import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAuthLocalDataNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';
import {
  deleteDurationLearningControl,
  loadDurationLearningControlsResult,
  upsertDurationLearningControl,
} from './durationLearningControlRepository';

let namespaceIndex = 0;
const first = '2026-09-25T00:00:00.000Z';
const later = '2026-09-25T00:00:01.000Z';

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`duration-control-${++namespaceIndex}`));
});

describe('Gate 7E duration-learning controls', () => {
  it('stores only explicit user control and does not persist a derived estimate', async () => {
    const saved = await upsertDurationLearningControl({
      templateId: 'weekly-paperwork',
      mode: 'override',
      overrideMinutes: 35,
    }, undefined, first);

    expect(saved.ok).toBe(true);
    const loaded = await loadDurationLearningControlsResult();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.controls).toEqual([{
      templateId: 'weekly-paperwork',
      mode: 'override',
      overrideMinutes: 35,
      createdAt: first,
      updatedAt: first,
    }]);
    expect(JSON.stringify(loaded.record)).not.toContain('median');
    expect(JSON.stringify(loaded.record)).not.toContain('sampleCount');
  });

  it('supports disabling and resetting one template without touching other controls', async () => {
    await upsertDurationLearningControl({ templateId: 'a', mode: 'disabled' }, undefined, first);
    await upsertDurationLearningControl({
      templateId: 'b',
      mode: 'override',
      overrideMinutes: 40,
    }, undefined, later);

    const reset = await deleteDurationLearningControl('a', undefined, later);
    expect(reset).toMatchObject({ ok: true, removed: true });
    if (!reset.ok) return;
    expect(reset.controls.map((control) => control.templateId)).toEqual(['b']);
  });

  it('rejects a backdated write so shared control metadata cannot move backwards', async () => {
    await upsertDurationLearningControl({ templateId: 'a', mode: 'disabled' }, undefined, later);
    const stale = await upsertDurationLearningControl({
      templateId: 'b',
      mode: 'override',
      overrideMinutes: 20,
    }, undefined, first);

    expect(stale.ok).toBe(false);
    const loaded = await loadDurationLearningControlsResult();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.controls.map((control) => control.templateId)).toEqual(['a']);
  });
});
