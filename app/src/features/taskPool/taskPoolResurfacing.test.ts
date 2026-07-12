import { describe, expect, it } from 'vitest';
import { taskPoolItemSchema, type TaskPoolItem } from '../../data/schemas';
import {
  buildTaskPoolResurfacingGroups,
  isTaskPoolItemReadyToRevisit,
  nextTaskPoolResurfacingAt,
} from './taskPoolResurfacing';

function poolItem(overrides: Partial<TaskPoolItem> = {}): TaskPoolItem {
  return taskPoolItemSchema.parse({
    area: 'admin',
    createdAt: '2026-07-01T00:00:00.000Z',
    full: { label: 'Complete the whole form', minutes: 20 },
    id: 'pool-school-form',
    minimum: { label: 'Open the form', minutes: 5 },
    normal: { label: 'Fill the first page', minutes: 10 },
    source: 'adhoc',
    status: 'captured',
    title: 'Send school form',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  });
}

describe('task Pool resurfacing', () => {
  it('keeps future deferred tasks held without calling them overdue', () => {
    const now = Date.parse('2026-07-12T08:00:00.000Z');
    const item = poolItem({
      bringBackAfter: '2026-07-13T08:00:00.000Z',
      status: 'deferred',
    });

    expect(isTaskPoolItemReadyToRevisit(item, now)).toBe(false);
    expect(buildTaskPoolResurfacingGroups([item], now)).toEqual([
      expect.objectContaining({
        id: 'bring-back-later',
        title: 'Bring back later',
        items: [item],
      }),
    ]);
  });

  it('moves arrived deferred tasks into a calm Ready to revisit group', () => {
    const now = Date.parse('2026-07-13T09:00:00.000Z');
    const item = poolItem({
      bringBackAfter: '2026-07-13T08:00:00.000Z',
      status: 'deferred',
    });

    expect(isTaskPoolItemReadyToRevisit(item, now)).toBe(true);
    expect(buildTaskPoolResurfacingGroups([item], now)).toEqual([
      expect.objectContaining({
        helper: 'The time you chose has arrived. Nothing moved automatically.',
        id: 'ready-to-revisit',
        title: 'Ready to revisit',
        items: [item],
      }),
    ]);
  });

  it('treats a deferred item without a return time as ready for a choice', () => {
    const item = poolItem({ status: 'deferred' });

    expect(isTaskPoolItemReadyToRevisit(item)).toBe(true);
  });

  it('returns the next future resurfacing time for an in-app timer', () => {
    const now = Date.parse('2026-07-12T08:00:00.000Z');
    const items = [
      poolItem({
        bringBackAfter: '2026-07-14T08:00:00.000Z',
        id: 'later',
        status: 'deferred',
      }),
      poolItem({
        bringBackAfter: '2026-07-13T08:00:00.000Z',
        id: 'next',
        status: 'deferred',
      }),
      poolItem({ id: 'captured', status: 'captured' }),
    ];

    expect(nextTaskPoolResurfacingAt(items, now)).toBe(Date.parse('2026-07-13T08:00:00.000Z'));
  });
});
