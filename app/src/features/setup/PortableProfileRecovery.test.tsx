// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortableProfileRecovery } from './PortableProfileRecovery';

const mock = vi.hoisted(() => ({ check: vi.fn(), restore: vi.fn(), exportBackup: vi.fn() }));
vi.mock('../../data/portableProfileBackup', () => ({
  checkPortableProfileForRestore: mock.check,
  restorePortableProfile: mock.restore,
  exportPortableProfile: mock.exportBackup,
  REPLACE_LOCAL_PROFILE_CONFIRMATION: 'REPLACE LOCAL PROFILE',
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('portable profile recovery controls', () => {
  it('requires successful check and explicit confirmation; edits invalidate the preview', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    mock.check.mockResolvedValue({ ok: true, expectation: 'snapshot', hasData: true,
      preview: { exportedAt: '2026-09-25T00:00:00.000Z', settingsPresent: true,
        pool: 1, today: 1, rhythms: 1, instances: 1, placements: 1,
        preferences: 1, durationControls: 1, behaviourEvents: 1, calendarPresent: true } });
    mock.restore.mockResolvedValue({ ok: true });
    render(<PortableProfileRecovery onReload={reload} />);
    expect(screen.queryByRole('button', { name: 'Restore backup' })).toBeNull();
    const field = screen.getByRole('textbox', { name: 'Or paste portable backup text' });
    fireEvent.change(field, { target: { value: '{"test":true}' } });
    await user.click(screen.getByRole('button', { name: 'Check backup' }));
    expect(screen.getByLabelText('Portable backup preview')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restore backup' })).toHaveProperty('disabled', true);
    await user.type(screen.getByRole('textbox', { name: 'Type REPLACE LOCAL PROFILE to replace this local profile' }), 'REPLACE LOCAL PROFILE');
    await user.click(screen.getByRole('button', { name: 'Restore backup' }));
    expect(mock.restore).toHaveBeenCalledWith('{"test":true}', 'snapshot', 'REPLACE LOCAL PROFILE');
    expect(reload).toHaveBeenCalledTimes(1);
    fireEvent.change(field, { target: { value: '{"test":true}x' } });
    expect(screen.queryByRole('button', { name: 'Restore backup' })).toBeNull();
  });

  it('does not enable restore for a failed check, and accepts file selection for checking', async () => {
    const user = userEvent.setup();
    mock.check.mockResolvedValue({ ok: false, errors: ['Unsupported portable backup.'] });
    render(<PortableProfileRecovery onReload={vi.fn()} />);
    const input = screen.getByLabelText('Select portable backup file');
    await user.upload(input, new File(['{"format":"other"}'], 'backup.json', { type: 'application/json' }));
    await user.click(screen.getByRole('button', { name: 'Check backup' }));
    expect(screen.getByRole('status').textContent).toContain('Unsupported portable backup.');
    expect(screen.queryByRole('button', { name: 'Restore backup' })).toBeNull();
  });
});
