// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryScreen } from '../../screens/LibraryScreen';
import {
  createAuthLocalDataNamespace,
  getCurrentLifeRhythmDatabase,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
} from '../../data/localDataNamespace';
import { parseRhythmAuthorityBackupJson } from '../../data/rhythmAuthorityBackup';
import { rhythmTemplateSchema } from '../../data/schemas';
import * as authorityRepository from '../../data/rhythmAuthorityRepository';
import { LibraryRhythmCard, type LibraryRhythmConfigurationView } from './LibraryRhythmCard';
import { mockLibraryRhythms } from './mockLibraryData';

let testIndex = 0;

beforeEach(() => {
  testIndex += 1;
  setCurrentLocalDataNamespace(createAuthLocalDataNamespace(`gate8a2-library-${testIndex}`));
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  const database = getCurrentLifeRhythmDatabase();
  database.close();
  await database.delete();
  resetCurrentLocalDataNamespace();
});

async function openBreakfastConfiguration(user: ReturnType<typeof userEvent.setup>) {
  render(<LibraryScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create rhythm' })).toHaveProperty('disabled', false));
  const card = screen.getByRole('article', { name: 'Breakfast reset' });
  await waitFor(() => expect(within(card).getByRole('button', { name: 'Configure and turn on' })).toHaveProperty('disabled', false));
  await user.click(within(card).getByRole('button', { name: 'Configure and turn on' }));
  return card;
}

async function saveMinimumOnly(user: ReturnType<typeof userEvent.setup>, minutes = '7') {
  await user.type(screen.getByLabelText('Minimum minutes'), minutes);
  await user.click(screen.getByRole('button', { name: 'Save rhythm' }));
  await screen.findByText(/Breakfast reset saved/);
}

describe('Gate 8A2 Library rhythm authority', () => {
  it.each(['enabled', 'paused', 'disabled', 'unconfigured'] as const)('disables %s card mutations while authority is unreadable', (state) => {
    const onConfigure = vi.fn();
    const onSetState = vi.fn();
    const onAddToday = vi.fn();
    const configuration: LibraryRhythmConfigurationView = { state, frequency: 2, period: 'week', minimumMinutes: 3 };
    render(<LibraryRhythmCard actionsDisabled configuration={configuration} onConfigure={onConfigure} onSetState={onSetState} onAddToday={onAddToday} rhythm={mockLibraryRhythms[0]} />);
    const card = screen.getByRole('article');
    const actions = within(card).getAllByRole('button');
    for (const button of actions) {
      if (button.textContent === 'Details') expect(button).toHaveProperty('disabled', false);
      else expect(button).toHaveProperty('disabled', true);
    }
  });
  it('keeps catalogue details readable but every write unavailable until saved authority loads', async () => {
    const database = getCurrentLifeRhythmDatabase();
    const originalRead = authorityRepository.loadRhythmAuthorityResult;
    const createdAt = '2026-01-01T01:00:00.000Z';
    const savedTemplate = rhythmTemplateSchema.parse({
      id: 'food-breakfast-reset', source: 'built-in', title: 'Breakfast reset', area: 'food',
      minimum: { label: 'Saved minimum', minutes: 3 },
      normal: { label: 'Saved normal', minutes: 17 },
      full: { label: 'Saved full', minutes: 29 },
      enabled: false, createdAt, updatedAt: createdAt,
    });
    await database.rhythmTemplates.put(savedTemplate);
    let finishRead!: (value: Awaited<ReturnType<typeof originalRead>>) => void;
    vi.spyOn(authorityRepository, 'loadRhythmAuthorityResult').mockImplementationOnce(() =>
      new Promise((resolve) => { finishRead = resolve; }));
    const save = vi.spyOn(authorityRepository, 'saveRhythmConfiguration');
    const user = userEvent.setup();
    render(<LibraryScreen />);
    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    expect(within(card).getByText('Saved state unavailable')).toBeTruthy();
    expect(within(card).queryByText('Needs configuration')).toBeNull();
    const add = within(card).getByRole('button', { name: 'Configure to add once' });
    expect(add).toHaveProperty('disabled', true);
    expect(within(card).queryByRole('button', { name: 'Configure and turn on' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Details' }));
    expect(within(card).getByText('Why this rhythm exists')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(save).not.toHaveBeenCalled();
    await database.rhythmTemplates.get(savedTemplate.id).then((row) => expect(row).toEqual(savedTemplate));

    const result = await originalRead();
    await waitFor(() => expect(typeof finishRead).toBe('function'));
    finishRead(result);
    await waitFor(() => expect(within(card).getByText('Needs configuration')).toBeTruthy());
    expect(within(card).getByRole('button', { name: 'Configure and turn on' })).toHaveProperty('disabled', false);
    expect(within(card).getByRole('button', { name: 'Configure to add once' })).toHaveProperty('disabled', false);
    expect(await database.rhythmTemplates.get(savedTemplate.id)).toEqual(savedTemplate);
  });

  it('keeps all mutations disabled after an authority read error, while Details remains readable', async () => {
    vi.spyOn(authorityRepository, 'loadRhythmAuthorityResult').mockResolvedValueOnce({
      status: 'readFailed', errors: ['Saved data could not be read.'],
    });
    const user = userEvent.setup();
    render(<LibraryScreen />);
    await screen.findByText('Saved rhythm configuration could not be read.');
    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    expect(within(card).getByText('Saved state unavailable')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Configure to add once' })).toHaveProperty('disabled', true);
    expect(within(card).queryByRole('button', { name: 'Configure and turn on' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Details' }));
    expect(within(card).getByText('Catalogue action ideas')).toBeTruthy();
    expect(await getCurrentLifeRhythmDatabase().rhythmTemplates.count()).toBe(0);
  });

  it('clears previous backup check results on selection and reports file-read failures', async () => {
    render(<LibraryScreen />);
    const editor = screen.getByRole('textbox', { name: 'Paste backup text' });
    const picker = screen.getByLabelText('Select backup file');
    const check = screen.getByRole('button', { name: 'Check rhythm backup' });
    fireEvent.change(editor, { target: { value: JSON.stringify({ format: 'life-rhythm-rhythm-authority-backup', version: 1, exportedAt: '2026-09-25T00:00:00.000Z', templates: [] }) } });
    fireEvent.click(check);
    expect(screen.getByText(/Valid backup:/)).toBeTruthy();
    fireEvent.change(picker, { target: { files: [{ text: async () => '{ bad' }] } });
    await waitFor(() => expect(editor).toHaveProperty('value', '{ bad'));
    expect(screen.queryByText(/Valid backup:/)).toBeNull();
    fireEvent.click(check);
    expect(screen.getByText(/Backup JSON is malformed/)).toBeTruthy();
    fireEvent.change(picker, { target: { files: [{ text: async () => '{}' }] } });
    await waitFor(() => expect(editor).toHaveProperty('value', '{}'));
    expect(screen.queryByText(/Backup JSON is malformed/)).toBeNull();
    fireEvent.change(picker, { target: { files: [{ text: async () => { throw new Error('read failed'); } }] } });
    expect(await screen.findByText('The selected backup file could not be read.')).toBeTruthy();
    fireEvent.change(picker, { target: { files: [] } });
    expect(screen.getByText('The selected backup file could not be read.')).toBeTruthy();
    expect(editor).toHaveProperty('value', '{}');
  });
  it('presents fixture rhythms as unconfigured suggestions and packs as preview-only', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);
    const card = await screen.findByRole('article', { name: 'Breakfast reset' });
    await waitFor(() => expect(within(card).getByText('Needs configuration')).toBeTruthy());
    expect(within(card).queryByText('Enabled')).toBeNull();
    await user.click(within(screen.getByRole('article', { name: 'Morning basics' }))
      .getByRole('button', { name: 'Preview pack' }));
    expect(screen.getByText('Preview only. Configure any rhythm individually before it can schedule.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enable selected rhythms/i })).toBeNull();
  });

  it('keeps a legacy custom template off and exposes its duration uncertainty on configuration', async () => {
    const timestamp = new Date().toISOString();
    const database = getCurrentLifeRhythmDatabase();
    await database.rhythmTemplates.put(rhythmTemplateSchema.parse({
      id: 'legacy-custom-rhythm', source: 'custom', title: 'Legacy custom rhythm', area: 'other',
      minimum: { label: 'Small version', minutes: 5 },
      normal: { label: 'Normal version', minutes: 10 },
      full: { label: 'Full version', minutes: 20 },
      enabled: false, createdAt: timestamp, updatedAt: timestamp,
    }));
    const user = userEvent.setup();
    render(<LibraryScreen />);
    const card = await screen.findByRole('article', { name: 'Legacy custom rhythm' });
    expect(within(card).getByText('Needs configuration')).toBeTruthy();
    expect(await database.rhythmPlans.count()).toBe(0);
    await user.click(within(card).getByRole('button', { name: 'Configure and turn on' }));
    expect(screen.getByText(/Older rhythm minutes may have been filled automatically/)).toBeTruthy();
    expect((screen.getByLabelText('Minimum minutes') as HTMLInputElement).value).toBe('5');
  });

  it('requires user-authored minutes and inherits omitted variants exactly', async () => {
    const user = userEvent.setup();
    await openBreakfastConfiguration(user);
    expect((screen.getByLabelText('Minimum minutes') as HTMLInputElement).value).toBe('');
    await saveMinimumOnly(user, '7');

    const database = getCurrentLifeRhythmDatabase();
    const template = await database.rhythmTemplates.get('food-breakfast-reset');
    const plan = await database.rhythmPlans.where('rhythmTemplateId').equals('food-breakfast-reset').first();
    expect(template?.minimum).toEqual({ label: 'Clear one surface and choose the easiest breakfast option.', minutes: 7 });
    expect(template?.normal).toEqual(template?.minimum);
    expect(template?.full).toEqual(template?.normal);
    expect(template?.enabled).toBe(false);
    expect(plan?.state).toBe('enabled');
  });

  it('persists exact Normal and Full actions and minutes', async () => {
    const user = userEvent.setup();
    await openBreakfastConfiguration(user);
    await user.type(screen.getByLabelText('Minimum minutes'), '4');
    await user.click(screen.getByRole('button', { name: /Optional Normal and Full/ }));
    await user.type(screen.getByLabelText('Normal action'), 'Eat something easy.');
    await user.type(screen.getByLabelText('Normal minutes'), '13');
    await user.type(screen.getByLabelText('Full action'), 'Eat and reset the bench.');
    await user.type(screen.getByLabelText('Full minutes'), '27');
    await user.click(screen.getByRole('button', { name: 'Save rhythm' }));
    await screen.findByText(/Breakfast reset saved/);
    const template = await getCurrentLifeRhythmDatabase().rhythmTemplates.get('food-breakfast-reset');
    expect(template?.minimum.minutes).toBe(4);
    expect(template?.normal).toEqual({ label: 'Eat something easy.', minutes: 13 });
    expect(template?.full).toEqual({ label: 'Eat and reset the bench.', minutes: 27 });
  });

  it('inherits omitted Full from the exact authored Normal action and minutes', async () => {
    const user = userEvent.setup();
    await openBreakfastConfiguration(user);
    await user.type(screen.getByLabelText('Minimum minutes'), '4');
    await user.click(screen.getByRole('button', { name: /Optional Normal and Full/ }));
    await user.type(screen.getByLabelText('Normal action'), 'Eat something easy.');
    await user.type(screen.getByLabelText('Normal minutes'), '13');
    await user.click(screen.getByRole('button', { name: 'Save rhythm' }));
    await screen.findByText(/Breakfast reset saved/);
    const template = await getCurrentLifeRhythmDatabase().rhythmTemplates.get('food-breakfast-reset');
    expect(template?.normal).toEqual({ label: 'Eat something easy.', minutes: 13 });
    expect(template?.full).toEqual(template?.normal);
  });

  it('shows a field-specific error for a non-positive duration', async () => {
    const user = userEvent.setup();
    await openBreakfastConfiguration(user);
    fireEvent.change(screen.getByLabelText('Minimum minutes'), { target: { value: '0' } });
    await user.click(screen.getByRole('button', { name: 'Save rhythm' }));
    expect(screen.getByRole('alert').textContent).toContain('Minimum duration in minutes must be a positive whole number.');
    expect(await getCurrentLifeRhythmDatabase().rhythmPlans.count()).toBe(0);
  });

  it('persists pause and re-enable without creating a second plan', async () => {
    const user = userEvent.setup();
    await openBreakfastConfiguration(user);
    await saveMinimumOnly(user);
    let card = screen.getByRole('article', { name: 'Breakfast reset' });
    await user.click(within(card).getByRole('button', { name: 'Pause rhythm' }));
    await waitFor(() => expect(within(card).getByText('Paused')).toBeTruthy());
    await user.click(within(card).getByRole('button', { name: 'Turn on rhythm' }));
    await waitFor(() => expect(within(card).getByText('On')).toBeTruthy());
    const database = getCurrentLifeRhythmDatabase();
    expect(await database.rhythmPlans.where('rhythmTemplateId').equals('food-breakfast-reset').count()).toBe(1);
    expect((await database.rhythmPlans.toArray())[0].state).toBe('enabled');
  });

  it('creates a custom rhythm with exact durations and a durable plan', async () => {
    const user = userEvent.setup();
    render(<LibraryScreen />);
    const createButton = await screen.findByRole('button', { name: 'Create rhythm' });
    await waitFor(() => expect((createButton as HTMLButtonElement).disabled).toBe(false));
    await user.click(createButton);
    await user.type(screen.getByLabelText('Rhythm title'), 'Paper landing');
    await user.selectOptions(screen.getByLabelText('Category'), 'Money');
    await user.type(screen.getByLabelText('Minimum action'), 'Put one paper away.');
    await user.type(screen.getByLabelText('Minimum minutes'), '6');
    await user.clear(screen.getByLabelText('Times'));
    await user.type(screen.getByLabelText('Times'), '2');
    await user.selectOptions(screen.getByLabelText('Per'), 'month');
    await user.click(screen.getByRole('button', { name: 'Save rhythm' }));
    await screen.findByText(/Paper landing saved/);
    const database = getCurrentLifeRhythmDatabase();
    const template = (await database.rhythmTemplates.toArray()).find((item) => item.title === 'Paper landing');
    expect(template).toMatchObject({ source: 'custom', minimum: { minutes: 6 }, normal: { minutes: 6 }, full: { minutes: 6 } });
    expect((await database.rhythmPlans.toArray())[0].rhythmTemplateId).toBe(template?.id);
    expect((await database.rhythmRecurrenceRevisions.toArray())[0].rule).toMatchObject({ frequency: 2, period: 'month' });
  });

  it('adds one configured rhythm once without enabling recurrence or duplicating Today', async () => {
    const user = userEvent.setup();
    await openBreakfastConfiguration(user);
    await user.type(screen.getByLabelText('Minimum minutes'), '9');
    await user.click(screen.getByRole('checkbox', { name: /Turn on after saving/ }));
    await user.click(screen.getByRole('button', { name: 'Save rhythm' }));
    await screen.findByText(/Breakfast reset saved/);
    const card = screen.getByRole('article', { name: 'Breakfast reset' });
    await user.click(within(card).getByRole('button', { name: 'Add to Today once' }));
    await screen.findByText(/was added once/);
    await user.click(within(card).getByRole('button', { name: 'Add to Today once' }));
    await screen.findByText(/already in Today/);
    const database = getCurrentLifeRhythmDatabase();
    expect(await database.activeTasks.count()).toBe(1);
    const task = (await database.activeTasks.toArray())[0];
    expect(task.minimum.minutes).toBe(9);
    expect(task.manualRhythmOccurrenceKey).toBeTruthy();
    expect((await database.rhythmPlans.toArray())[0].state).toBe('disabled');
  });

  it('exports and checks a referentially complete rhythm authority backup', async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    let exportedBlob: Blob | undefined;
    URL.createObjectURL = (blob) => { exportedBlob = blob as Blob; return 'blob:rhythms'; };
    URL.revokeObjectURL = () => undefined;
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => undefined;
    try {
      const user = userEvent.setup();
      await openBreakfastConfiguration(user);
      await saveMinimumOnly(user);
      await user.click(screen.getByRole('button', { name: 'Export rhythm backup' }));
      await screen.findByText(/backup created/);
      const json = await exportedBlob!.text();
      const checked = parseRhythmAuthorityBackupJson(json);
      expect(checked.ok).toBe(true);
      if (checked.ok) expect(checked.preview.dependencyState).toBe('complete');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = click;
    }
  });
});
