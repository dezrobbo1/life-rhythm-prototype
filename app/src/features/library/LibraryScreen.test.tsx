// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildLibraryRhythmBackupPayload,
  libraryRhythmBackupSchema,
  serializeLibraryRhythmBackup,
} from '../../data/libraryRhythmBackup';
import { activeTaskSchema, rhythmTemplateSchema, type ActiveTask, type RhythmTemplate } from '../../data/schemas';

const activeTaskRepositoryMocks = vi.hoisted(() => ({
  createActiveTaskId: vi.fn((prefix = 'active-task') => `${prefix}-test-id`),
  loadActiveTodayTasks: vi.fn(),
  saveActiveTodayTask: vi.fn(),
}));

const libraryRepositoryMocks = vi.hoisted(() => ({
  loadCustomLibraryRhythms: vi.fn(),
  saveCustomLibraryRhythm: vi.fn(),
}));

vi.mock('../../data/activeTaskRepository', () => activeTaskRepositoryMocks);
vi.mock('../../data/libraryRhythmRepository', () => libraryRepositoryMocks);

import App from '../../App';
import { LibraryScreen } from '../../screens/LibraryScreen';

function savedRhythmTemplate(overrides: Partial<RhythmTemplate> = {}): RhythmTemplate {
  return rhythmTemplateSchema.parse({
    area: 'money',
    createdAt: '2026-06-16T00:00:00.000Z',
    full: {
      label: 'Put papers together and name the next admin step.',
      minutes: 20,
    },
    id: 'custom-paperwork-landing',
    minimum: {
      label: 'Put one paper in the folder.',
      minutes: 5,
    },
    normal: {
      label: 'Put the loose papers in one safe place.',
      minutes: 10,
    },
    purpose: 'Give loose paperwork one safe place.',
    source: 'custom',
    title: 'Paperwork landing',
    updatedAt: '2026-06-16T00:00:00.000Z',
    ...overrides,
  });
}

function validLibraryBackupJson(overrides: Partial<RhythmTemplate> = {}) {
  return serializeLibraryRhythmBackup(
    buildLibraryRhythmBackupPayload([
      savedRhythmTemplate({
        id: 'custom-backup-paperwork',
        title: 'Backup paperwork rhythm',
        ...overrides,
      }),
    ], '2026-06-16T00:00:00.000Z'),
  );
}

const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

function mockDownloadApi() {
  const createObjectUrl = vi.fn((blob: Blob) => {
    void blob;
    return 'blob:library-rhythm-backup';
  });
  const revokeObjectUrl = vi.fn();
  const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectUrl,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectUrl,
  });

  return {
    anchorClick,
    createObjectUrl,
    revokeObjectUrl,
  };
}

beforeEach(() => {
  activeTaskRepositoryMocks.loadActiveTodayTasks.mockResolvedValue([]);
  activeTaskRepositoryMocks.saveActiveTodayTask.mockImplementation(async (task: ActiveTask) => ({
    alreadyExists: false,
    ok: true,
    task: activeTaskSchema.parse(task),
  }));
  libraryRepositoryMocks.loadCustomLibraryRhythms.mockResolvedValue([]);
  libraryRepositoryMocks.saveCustomLibraryRhythm.mockImplementation(async (rhythm: unknown) => ({
    ok: true,
    rhythm: rhythmTemplateSchema.parse(rhythm),
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();

  if (originalCreateObjectUrl) {
    Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl);
  } else {
    Reflect.deleteProperty(URL, 'createObjectURL');
  }

  if (originalRevokeObjectUrl) {
    Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl);
  } else {
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  }
});

describe('Library screen', () => {
  async function fillCreateRhythmForm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Create rhythm' }));
    await user.type(screen.getByLabelText('Rhythm title'), 'Paperwork landing');
    await user.selectOptions(screen.getByLabelText('Category'), 'Money');
    await user.type(screen.getByLabelText('Purpose'), 'Give loose paperwork one safe place.');
    await user.type(screen.getByLabelText('Minimum version'), 'Put one paper in the folder.');
  }

  it('renders library categories', () => {
    render(<LibraryScreen />);

    const categories = screen.getByRole('list', { name: 'Library categories' });
    expect(within(categories).getByRole('button', { name: 'All' })).toBeTruthy();
    expect(within(categories).getByRole('button', { name: 'Food' })).toBeTruthy();
    expect(within(categories).getByRole('button', { name: 'Money' })).toBeTruthy();
    expect(within(categories).getByRole('button', { name: 'Start Boost' })).toBeTruthy();
  });

  it('renders rhythm catalogue cards', () => {
    render(<LibraryScreen />);

    expect(screen.getByRole('button', { name: 'Create rhythm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export Library rhythms backup' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Create pack later' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Create rhythm makes a reusable template/)).toBeTruthy();
    expect(screen.getByText(/This backup includes saved custom Library rhythms only. It does not include Today tasks./)).toBeTruthy();
    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    expect(within(card).getByText('Food')).toBeTruthy();
    expect(within(card).getByText('Make the first food step visible and small.')).toBeTruthy();
    expect(within(card).getAllByText(/Morning|Easy start/)).toHaveLength(2);
    expect(screen.getByRole('article', { name: 'Open the first file' })).toBeTruthy();
  });

  it('filters rhythms by category', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await user.click(screen.getByRole('button', { name: 'Money' }));

    expect(screen.getByRole('article', { name: 'Receipt drop' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Breakfast reset' })).toBeNull();
  });

  it('changes enabled state in mock UI only', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    expect(within(card).getByText('Disabled')).toBeTruthy();

    await user.click(within(card).getByRole('button', { name: 'Enable rhythm' }));

    expect(within(card).getByText('Enabled')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Disable rhythm' })).toBeTruthy();
  });

  it('persists Add to Today as one active task without writing Library rhythms', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<LibraryScreen />);

    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    await user.click(within(card).getByRole('button', { name: 'Add to Today now' }));

    expect(screen.getByRole('status').textContent).toContain('Breakfast reset saved to Today on this device.');
    expect(screen.getByRole('status').textContent).toContain('Library enablement did not change.');
    expect(activeTaskRepositoryMocks.saveActiveTodayTask).toHaveBeenCalledTimes(1);
    expect(activeTaskRepositoryMocks.saveActiveTodayTask.mock.calls[0][0]).toMatchObject({
      source: 'library',
      templateId: 'food-breakfast-reset',
      showToday: true,
      status: 'active',
      title: 'Breakfast reset',
    });
    expect(libraryRepositoryMocks.saveCustomLibraryRhythm).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('does not duplicate Add to Today when the active task already exists', async () => {
    activeTaskRepositoryMocks.saveActiveTodayTask.mockImplementationOnce(async (task: ActiveTask) => ({
      alreadyExists: true,
      ok: true,
      task: activeTaskSchema.parse(task),
    }));
    const user = userEvent.setup();
    render(<LibraryScreen />);

    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    await user.click(within(card).getByRole('button', { name: 'Add to Today now' }));

    expect(screen.getByRole('status').textContent).toContain('Breakfast reset is already in Today on this device.');
    expect(libraryRepositoryMocks.saveCustomLibraryRhythm).not.toHaveBeenCalled();
  });

  it('opens Create rhythm as a reusable preview modal', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await user.click(screen.getByRole('button', { name: 'Create rhythm' }));

    expect(screen.getByRole('dialog', { name: 'Create rhythm' })).toBeTruthy();
    expect(screen.getByText('Reusable rhythm. Saved on this device. Enablement and Add to Today are preview-only.')).toBeTruthy();
    expect(screen.getByLabelText('Rhythm title')).toBeTruthy();
    expect(screen.getByLabelText('Category')).toBeTruthy();
    expect(screen.getByLabelText('Purpose')).toBeTruthy();
    expect(screen.getByLabelText('Minimum version')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Enabled/ })).toBeTruthy();
  });

  it('saves a created rhythm through the custom Library rhythm repository', async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<LibraryScreen />);

    await fillCreateRhythmForm(user);
    await user.click(screen.getByRole('button', { name: 'Save rhythm' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create rhythm' })).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Rhythm saved to Library on this device.');
    expect(screen.getByRole('status').textContent).toContain('Enablement and Add to Today are still preview-only.');
    expect(screen.getByRole('article', { name: 'Paperwork landing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Money' }).getAttribute('aria-pressed')).toBe('true');
    expect(libraryRepositoryMocks.saveCustomLibraryRhythm).toHaveBeenCalledTimes(1);
    expect(libraryRepositoryMocks.saveCustomLibraryRhythm.mock.calls[0][0]).toMatchObject({
      area: 'money',
      source: 'custom',
      title: 'Paperwork landing',
    });
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('exports saved custom Library rhythms as a valid backup download', async () => {
    libraryRepositoryMocks.loadCustomLibraryRhythms.mockResolvedValue([savedRhythmTemplate()]);
    const { anchorClick, createObjectUrl, revokeObjectUrl } = mockDownloadApi();
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await user.click(screen.getByRole('button', { name: 'Export Library rhythms backup' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Library rhythms backup created on this device.'));
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:library-rhythm-backup');

    const blob = createObjectUrl.mock.calls[0][0] as Blob;
    const json = await blob.text();
    const payload = libraryRhythmBackupSchema.parse(JSON.parse(json));

    expect(payload.rhythms).toHaveLength(1);
    expect(payload.rhythms[0]).toMatchObject({
      id: 'custom-paperwork-landing',
      source: 'custom',
      title: 'Paperwork landing',
    });
    expect(json).not.toMatch(/settings|activeTasks|oneOff|scheduler|devTickets|migrationLog|resetLog|futureModules/i);
    expect(json).not.toContain('lifeRhythm_v146');
    expect(json).not.toContain('Breakfast reset');
  });

  it('shows an empty export message without downloading when no custom rhythms are saved', async () => {
    const { anchorClick, createObjectUrl } = mockDownloadApi();
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await user.click(screen.getByRole('button', { name: 'Export Library rhythms backup' }));

    expect(screen.getByRole('status').textContent).toContain('No saved custom rhythms to export yet.');
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it('renders the Library rhythm backup checker UI', () => {
    render(<LibraryScreen />);

    expect(screen.getByRole('heading', { name: 'Check Library rhythms backup' })).toBeTruthy();
    expect(screen.getByLabelText('Library rhythm backup JSON')).toBeTruthy();
    expect(screen.getByLabelText('Select Library backup file')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check Library rhythms backup' })).toBeTruthy();
    expect(screen.getByText('Checking a backup does not change anything on this device. Restore is not connected yet.')).toBeTruthy();
  });

  it('validates pasted Library backup JSON and shows a preview without saving', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    fireEvent.change(screen.getByLabelText('Library rhythm backup JSON'), {
      target: { value: validLibraryBackupJson() },
    });
    await user.click(screen.getByRole('button', { name: 'Check Library rhythms backup' }));

    expect(screen.getByRole('status').textContent).toContain('Library rhythms backup looks valid. Restore is not connected yet.');
    const preview = screen.getByLabelText('Library rhythm backup preview');
    expect(within(preview).getByText('1')).toBeTruthy();
    expect(within(preview).getByText('Backup paperwork rhythm')).toBeTruthy();
    expect(libraryRepositoryMocks.saveCustomLibraryRhythm).not.toHaveBeenCalled();
  });

  it('shows invalid pasted JSON feedback without changing Library rhythms', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    expect(screen.queryByRole('article', { name: 'Backup paperwork rhythm' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Library rhythm backup JSON'), {
      target: { value: '{ not json' },
    });
    await user.click(screen.getByRole('button', { name: 'Check Library rhythms backup' }));

    expect(screen.getByRole('status').textContent).toContain('This Library rhythms backup could not be used.');
    expect(screen.getByRole('list', { name: 'Library rhythm backup errors' }).textContent).toContain('malformed');
    expect(screen.queryByRole('article', { name: 'Backup paperwork rhythm' })).toBeNull();
    expect(libraryRepositoryMocks.saveCustomLibraryRhythm).not.toHaveBeenCalled();
  });

  it('validates a selected Library backup file', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await user.upload(
      screen.getByLabelText('Select Library backup file'),
      new File([validLibraryBackupJson()], 'library-backup.json', { type: 'application/json' }),
    );
    expect(screen.getByRole('status').textContent).toContain('Library rhythms backup loaded. Choose Check Library rhythms backup.');

    await user.click(screen.getByRole('button', { name: 'Check Library rhythms backup' }));

    expect(screen.getByRole('status').textContent).toContain('Library rhythms backup looks valid. Restore is not connected yet.');
    expect(screen.getByLabelText('Library rhythm backup preview').textContent).toContain('Backup paperwork rhythm');
  });

  it('shows invalid feedback for a selected malformed Library backup file', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await user.upload(
      screen.getByLabelText('Select Library backup file'),
      new File(['{ no'], 'library-backup.json', { type: 'application/json' }),
    );
    await user.click(screen.getByRole('button', { name: 'Check Library rhythms backup' }));

    expect(screen.getByRole('status').textContent).toContain('This Library rhythms backup could not be used.');
    expect(screen.getByRole('list', { name: 'Library rhythm backup errors' }).textContent).toContain('malformed');
  });

  it('checks Library backups without Dexie writes or localStorage use', async () => {
    const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    const indexedDB = {
      deleteDatabase: vi.fn(() => {
        throw new Error('IndexedDB must not be changed');
      }),
      open: vi.fn(() => {
        throw new Error('IndexedDB must not be opened');
      }),
    };
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: indexedDB,
    });

    try {
      render(<LibraryScreen />);
      fireEvent.change(screen.getByLabelText('Library rhythm backup JSON'), {
        target: { value: validLibraryBackupJson() },
      });
      await user.click(screen.getByRole('button', { name: 'Check Library rhythms backup' }));

      expect(screen.getByRole('status').textContent).toContain('Library rhythms backup looks valid.');
      expect(indexedDB.open).not.toHaveBeenCalled();
      expect(indexedDB.deleteDatabase).not.toHaveBeenCalled();
      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
      expect(libraryRepositoryMocks.saveCustomLibraryRhythm).not.toHaveBeenCalled();
    } finally {
      if (originalIndexedDb) {
        Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb);
      } else {
        Reflect.deleteProperty(globalThis, 'indexedDB');
      }
    }
  });

  it('checks Library backups without affecting enablement state', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    await user.click(within(card).getByRole('button', { name: 'Enable rhythm' }));

    expect(within(card).getByText('Enabled')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Library rhythm backup JSON'), {
      target: { value: validLibraryBackupJson() },
    });
    await user.click(screen.getByRole('button', { name: 'Check Library rhythms backup' }));

    expect(within(card).getByText('Enabled')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Disable rhythm' })).toBeTruthy();
  });

  it('keeps the Create rhythm modal open with entered values when save fails', async () => {
    libraryRepositoryMocks.saveCustomLibraryRhythm.mockResolvedValueOnce({
      errors: ['id: A Library rhythm with this ID already exists.'],
      ok: false,
    });
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await fillCreateRhythmForm(user);
    await user.click(screen.getByRole('button', { name: 'Save rhythm' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Rhythm was not saved. Check the required fields.');
    expect(screen.getByRole('dialog', { name: 'Create rhythm' })).toBeTruthy();
    expect((screen.getByLabelText('Rhythm title') as HTMLInputElement).value).toBe('Paperwork landing');
    expect((screen.getByLabelText('Purpose') as HTMLInputElement).value).toBe('Give loose paperwork one safe place.');
    expect((screen.getByLabelText('Minimum version') as HTMLInputElement).value).toBe('Put one paper in the folder.');
    expect(screen.getByRole('status').textContent).toContain('Rhythm was not saved. Check the required fields.');
    expect(screen.queryByRole('article', { name: 'Paperwork landing' })).toBeNull();
  });

  it('prevents duplicate Create rhythm saves while saving', async () => {
    let finishSave: (() => void) | undefined;
    libraryRepositoryMocks.saveCustomLibraryRhythm.mockImplementationOnce(
      async (rhythm: unknown) =>
        new Promise((resolve) => {
          finishSave = () => resolve({
            ok: true,
            rhythm: rhythmTemplateSchema.parse(rhythm),
          });
        }),
    );
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await fillCreateRhythmForm(user);
    const saveButton = screen.getByRole('button', { name: 'Save rhythm' });

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(libraryRepositoryMocks.saveCustomLibraryRhythm).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: 'Saving rhythm...' }) as HTMLButtonElement).disabled).toBe(true);

    finishSave?.();

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create rhythm' })).toBeNull());
    expect(screen.getByRole('article', { name: 'Paperwork landing' })).toBeTruthy();
  });

  it('reloads saved custom rhythms from the repository', async () => {
    libraryRepositoryMocks.loadCustomLibraryRhythms.mockResolvedValue([savedRhythmTemplate()]);

    const user = userEvent.setup();
    render(<LibraryScreen />);

    const card = await screen.findByRole('article', { name: 'Paperwork landing' });
    await user.click(within(card).getByRole('button', { name: 'Details' }));

    expect(within(card).getByText('This custom rhythm was created by you and saved on this device.')).toBeTruthy();
  });

  it('does not restore Library enablement as persisted state', async () => {
    libraryRepositoryMocks.loadCustomLibraryRhythms.mockResolvedValue([savedRhythmTemplate({ enabled: true })]);

    render(<LibraryScreen />);

    const card = await screen.findByRole('article', { name: 'Paperwork landing' });
    expect(within(card).getByText('Disabled')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Enable rhythm' })).toBeTruthy();
  });

  it('does not add a created rhythm to Today', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Library' }));
    await fillCreateRhythmForm(user);
    await user.click(screen.getByRole('button', { name: 'Save rhythm' }));

    await waitFor(() => expect(screen.getByRole('article', { name: 'Paperwork landing' })).toBeTruthy());

    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(screen.queryByRole('article', { name: 'Paperwork landing' })).toBeNull();
  });

  it('opens rhythm details disclosure', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    const card = screen.getByRole('article', { name: 'Receipt drop' });
    await user.click(within(card).getByRole('button', { name: 'Details' }));

    expect(within(card).getByRole('heading', { name: 'Why this rhythm exists' })).toBeTruthy();
    expect(within(card).getByText('Money rhythms are organisation support, not financial advice.')).toBeTruthy();
  });

  it('renders quick pack preview', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    const pack = screen.getByRole('article', { name: 'Morning basics' });
    await user.click(within(pack).getByRole('button', { name: 'Preview pack' }));

    expect(within(pack).getByText('Packs enable rhythms. Today only shows what fits.')).toBeTruthy();
    expect(within(pack).getByText('Breakfast reset')).toBeTruthy();
    expect(within(pack).getByText('Kitchen landing')).toBeTruthy();
  });

  it('shows empty state and clears filters', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);

    await user.type(screen.getByRole('searchbox'), 'zzzz no match');

    expect(screen.getByText('No rhythms match this filter')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('article', { name: 'Breakfast reset' })).toBeTruthy();
  });

  it('keeps Setup available while Reset is available', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('heading', { name: 'Reset' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Setup' }));
    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeTruthy();
  });

  it('keeps bottom navigation available', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Library' }));

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Plan' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Library' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Library' })).toBeTruthy();
  });
});
