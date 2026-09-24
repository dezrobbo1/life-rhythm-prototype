import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  commitDurationLearningControlDelete,
  commitDurationLearningControlUpsert,
  durationLearningControlExpectation,
} from './durationLearningControlMutationCoordinator';
import {
  loadDurationLearningControlsResult,
  upsertDurationLearningControl,
} from './durationLearningControlRepository';
import {
  createAuthLocalDataNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from './localDataNamespace';

let namespaceIndex = 0;
const first = '2026-09-25T00:00:00.000Z';

beforeEach(() => {
  resetCurrentLocalDataNamespace();
  setCurrentLocalDataNamespace(
    createAuthLocalDataNamespace(`duration-control-mutation-${++namespaceIndex}`),
  );
});

async function expectationFor(templateId: string) {
  const loaded = await loadDurationLearningControlsResult();
  const expectation = durationLearningControlExpectation(loaded, templateId);
  if (!expectation) throw new Error('Expected healthy duration-control state.');
  return expectation;
}

describe('Gate 7E duration-control mutation coordination', () => {
  it('rejects a delayed same-template edit after that control changed', async () => {
    await upsertDurationLearningControl({
      templateId: 'paperwork',
      mode: 'override',
      overrideMinutes: 25,
    }, undefined, first);
    const stale = await expectationFor('paperwork');
    const current = await expectationFor('paperwork');

    const saved = await commitDurationLearningControlUpsert({
      templateId: 'paperwork',
      mode: 'override',
      overrideMinutes: 30,
    }, current, undefined, '2026-09-25T00:00:00.002Z');
    expect(saved.ok).toBe(true);

    const rejected = await commitDurationLearningControlUpsert({
      templateId: 'paperwork',
      mode: 'disabled',
    }, stale, undefined, '2026-09-25T00:00:00.003Z');
    expect(rejected).toMatchObject({ ok: false, conflict: 'stale' });
  });

  it('preserves independent template edits when command timestamps commit out of order', async () => {
    await upsertDurationLearningControl({
      templateId: 'a',
      mode: 'override',
      overrideMinutes: 20,
    }, undefined, first);
    await upsertDurationLearningControl({
      templateId: 'b',
      mode: 'override',
      overrideMinutes: 30,
    }, undefined, first);
    const expectationA = await expectationFor('a');
    const expectationB = await expectationFor('b');

    const b = await commitDurationLearningControlUpsert({
      templateId: 'b',
      mode: 'disabled',
    }, expectationB, undefined, '2026-09-25T00:00:00.002Z');
    const a = await commitDurationLearningControlUpsert({
      templateId: 'a',
      mode: 'disabled',
    }, expectationA, undefined, '2026-09-25T00:00:00.001Z');

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const loaded = await loadDurationLearningControlsResult();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.record.updatedAt).toBe('2026-09-25T00:00:00.002Z');
    expect(loaded.controls.map((control) => [control.templateId, control.mode])).toEqual([
      ['a', 'disabled'],
      ['b', 'disabled'],
    ]);
  });

  it('rejects a stale save after the same template control was reset', async () => {
    await upsertDurationLearningControl({
      templateId: 'paperwork',
      mode: 'override',
      overrideMinutes: 25,
    }, undefined, first);
    const stale = await expectationFor('paperwork');
    const current = await expectationFor('paperwork');

    const removed = await commitDurationLearningControlDelete(
      'paperwork',
      current,
      undefined,
      '2026-09-25T00:00:00.001Z',
    );
    expect(removed).toMatchObject({ ok: true, removed: true });

    const rejected = await commitDurationLearningControlUpsert({
      templateId: 'paperwork',
      mode: 'override',
      overrideMinutes: 40,
    }, stale, undefined, '2026-09-25T00:00:00.001Z');
    expect(rejected).toMatchObject({ ok: false, conflict: 'stale' });
  });
});
