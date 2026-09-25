import { describe, expect, it } from 'vitest';
import { resolveTaskVersions, type TaskVersionInput } from './taskVersionInput';

const minimumOnly: TaskVersionInput = {
  minimumVersion: ' Open the folder ', minimumMinutes: '7',
  normalVersion: '', normalMinutes: '', fullVersion: '', fullMinutes: '',
};

describe('authored task versions', () => {
  it('inherits the exact preceding action and duration for empty optional pairs', () => {
    expect(resolveTaskVersions(minimumOnly)).toEqual({
      ok: true,
      versions: {
        minimum: { label: 'Open the folder', minutes: 7 },
        normal: { label: 'Open the folder', minutes: 7 },
        full: { label: 'Open the folder', minutes: 7 },
      },
    });
    expect(resolveTaskVersions({ ...minimumOnly, normalVersion: 'Sort files', normalMinutes: '37' }))
      .toMatchObject({ ok: true, versions: { full: { label: 'Sort files', minutes: 37 } } });
  });

  it('preserves distinct entered durations without inventing a scheduling size', () => {
    expect(resolveTaskVersions({
      ...minimumOnly, normalVersion: 'Sort files', normalMinutes: '19',
      fullVersion: 'File everything', fullMinutes: '43',
    })).toMatchObject({
      ok: true, versions: {
        minimum: { minutes: 7 }, normal: { minutes: 19 }, full: { minutes: 43 },
      },
    });
  });

  it.each([
    [{ ...minimumOnly, minimumMinutes: '' }, 'Minimum minutes'],
    [{ ...minimumOnly, minimumMinutes: '2.5' }, 'Minimum minutes'],
    [{ ...minimumOnly, minimumMinutes: '0' }, 'Minimum minutes'],
    [{ ...minimumOnly, normalVersion: 'Sort files' }, 'Normal minutes'],
    [{ ...minimumOnly, normalMinutes: '19' }, 'Normal action'],
    [{ ...minimumOnly, fullVersion: 'Finish' }, 'Full minutes'],
    [{ ...minimumOnly, fullMinutes: '43' }, 'Full action'],
  ] as const)('rejects a specific invalid or incomplete version', (input, field) => {
    expect(resolveTaskVersions(input)).toMatchObject({ ok: false, error: expect.stringContaining(field) });
  });
});
