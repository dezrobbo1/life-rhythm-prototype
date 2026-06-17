import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Button, Card, EmptyState } from '../components';
import {
  createActiveTaskId,
  saveActiveTodayTask,
} from '../data/activeTaskRepository';
import { useAppSnapshot } from '../data/AppSnapshotProvider';
import {
  parseLibraryRhythmBackupJson,
  type LibraryRhythmBackupPreview,
} from '../data/libraryRhythmBackup';
import {
  exportLibraryRhythmBackup,
  type LibraryRhythmBackupExport,
} from '../data/libraryRhythmExport';
import {
  loadCustomLibraryRhythms,
  saveCustomLibraryRhythm,
} from '../data/libraryRhythmRepository';
import { activeTaskSchema, rhythmTemplateSchema, type ActiveTask, type RhythmTemplate } from '../data/schemas';
import {
  CreateRhythmModal,
  type CreateRhythmInput,
} from '../features/library/CreateRhythmModal';
import { LibraryRhythmCard } from '../features/library/LibraryRhythmCard';
import { QuickPackCard } from '../features/library/QuickPackCard';
import {
  libraryCategories,
  mockLibraryRhythms,
  mockQuickPacks,
  type LibraryCategory,
  type LibraryRhythm,
  type QuickPack,
} from '../features/library/mockLibraryData';
import {
  buildLibraryViewModel,
  type AppDataSnapshot,
  type LibraryRhythmViewModel,
  type SnapshotRhythmTemplate,
} from '../viewModels';

type RhythmArea = RhythmTemplate['area'];
type RhythmTaskType = RhythmTemplate['taskType'];

const categoryToArea: Record<LibraryRhythm['category'], RhythmArea> = {
  'Anti-scroll': 'antidrift',
  'Emotional recovery': 'emotion',
  Food: 'food',
  Household: 'house',
  Money: 'money',
  Motivation: 'other',
  Movement: 'movement',
  'Sensory load': 'sensory',
  Sleep: 'health',
  'Social support': 'social',
  'Start Boost': 'other',
  'Work focus': 'work',
};

const areaToCategory: Record<RhythmArea, LibraryRhythm['category']> = {
  admin: 'Household',
  antidrift: 'Anti-scroll',
  emotion: 'Emotional recovery',
  food: 'Food',
  health: 'Sleep',
  house: 'Household',
  money: 'Money',
  movement: 'Movement',
  other: 'Motivation',
  sensory: 'Sensory load',
  social: 'Social support',
  work: 'Work focus',
};

const areaToTaskType: Record<RhythmArea, RhythmTaskType> = {
  admin: 'admin',
  antidrift: 'simple',
  emotion: 'emotion',
  food: 'food',
  health: 'simple',
  house: 'house',
  money: 'admin',
  movement: 'exercise',
  other: 'simple',
  sensory: 'sensory',
  social: 'social',
  work: 'work',
};

function toSnapshotRhythm(rhythm: LibraryRhythm): SnapshotRhythmTemplate {
  return {
    category: rhythm.category,
    chips: rhythm.chips,
    enabled: rhythm.enabled,
    full: { label: rhythm.fullVersion },
    id: rhythm.id,
    minimum: { label: rhythm.minimumVersion },
    normal: { label: rhythm.normalVersion },
    purpose: rhythm.purpose,
    title: rhythm.title,
  };
}

const libraryScreenSnapshot: AppDataSnapshot = {
  quickPacks: mockQuickPacks,
  rhythmTemplates: mockLibraryRhythms.map(toSnapshotRhythm),
};

function rhythmFromViewModel(rhythm: LibraryRhythmViewModel): LibraryRhythm {
  const source = mockLibraryRhythms.find((item) => item.id === rhythm.id);

  return {
    boundaryNote: source?.boundaryNote ?? 'Reusable rhythm support stays optional and user-led.',
    category: rhythm.category as LibraryRhythm['category'],
    categoryNote: source?.categoryNote ?? 'Keep this calm, visible, and easy to stop.',
    chips: rhythm.chips,
    enabled: rhythm.enabled,
    fullVersion: rhythm.fullVersion,
    id: rhythm.id,
    minimumVersion: rhythm.minimumVersion,
    normalVersion: rhythm.normalVersion,
    packIds: source?.packIds ?? [],
    purpose: rhythm.purpose,
    recommendedSize: source?.recommendedSize ?? rhythm.recommendedSize,
    title: rhythm.title,
    whyThisExists: source?.whyThisExists ?? 'This rhythm can be turned on when it is useful.',
  };
}

function safeSlug(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  return slug || 'rhythm';
}

function randomIdSegment() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}`;
}

function templateFromCreatedRhythm(input: CreateRhythmInput): RhythmTemplate {
  const timestamp = new Date().toISOString();
  const area = categoryToArea[input.category];

  return rhythmTemplateSchema.parse({
    area,
    createdAt: timestamp,
    enabled: false,
    full: {
      label: input.fullVersion || input.normalVersion || input.minimumVersion,
      minutes: 20,
    },
    id: `custom-${safeSlug(input.title)}-${randomIdSegment()}`,
    kind: 'repeating',
    minimum: {
      label: input.minimumVersion,
      minutes: 5,
    },
    normal: {
      label: input.normalVersion || input.minimumVersion,
      minutes: 10,
    },
    purpose: input.purpose,
    source: 'custom',
    taskType: areaToTaskType[area],
    title: input.title,
    updatedAt: timestamp,
  });
}

function rhythmFromTemplate(template: RhythmTemplate, sessionEnabled = false): LibraryRhythm {
  const category = areaToCategory[template.area] ?? 'Motivation';

  return {
    boundaryNote: 'Saved custom rhythms stay reusable. Enablement and Add to Today are preview-only for now.',
    category,
    categoryNote: 'Keep this rhythm optional, reusable, and small enough to return to.',
    chips: ['Custom', 'Saved'],
    enabled: sessionEnabled,
    fullVersion: template.full.label,
    id: template.id,
    minimumVersion: template.minimum.label,
    normalVersion: template.normal.label,
    packIds: [],
    purpose: template.purpose ?? 'Reusable support for later planning.',
    recommendedSize: `${template.minimum.minutes}-${template.normal.minutes} min`,
    title: template.title,
    whyThisExists: 'This custom rhythm was created by you and saved on this device.',
  };
}

function mergeRhythms(current: LibraryRhythm[], additions: LibraryRhythm[]) {
  const existingIds = new Set(current.map((rhythm) => rhythm.id));

  return [
    ...additions.filter((rhythm) => !existingIds.has(rhythm.id)),
    ...current,
  ];
}

function activeTaskFromLibraryRhythm(rhythm: LibraryRhythm): ActiveTask {
  const timestamp = new Date().toISOString();
  const area = categoryToArea[rhythm.category];

  return activeTaskSchema.parse({
    area,
    createdAt: timestamp,
    full: {
      label: rhythm.fullVersion,
      minutes: 20,
    },
    id: createActiveTaskId(`library-${rhythm.id}`),
    minimum: {
      label: rhythm.minimumVersion,
      minutes: 5,
    },
    normal: {
      label: rhythm.normalVersion,
      minutes: 10,
    },
    purpose: rhythm.purpose,
    showToday: true,
    source: 'library',
    status: 'active',
    taskType: areaToTaskType[area],
    templateId: rhythm.id,
    title: rhythm.title,
    updatedAt: timestamp,
  });
}

function downloadLibraryRhythmBackup(backup: LibraryRhythmBackupExport) {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }

  const blob = new Blob([backup.json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = backup.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function LibraryScreen() {
  const { snapshot } = useAppSnapshot();
  const initialLibraryViewModel = useMemo(
    () =>
      buildLibraryViewModel({
        ...snapshot,
        ...libraryScreenSnapshot,
      }),
    [snapshot],
  );
  const [libraryRhythms, setLibraryRhythms] = useState<LibraryRhythm[]>(() =>
    initialLibraryViewModel.reusableRhythms.map(rhythmFromViewModel),
  );
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('All');
  const [enabledById, setEnabledById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialLibraryViewModel.reusableRhythms.map((rhythm) => [rhythm.id, rhythm.enabled])),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [createRhythmOpen, setCreateRhythmOpen] = useState(false);
  const [previewPackId, setPreviewPackId] = useState<string | null>(null);
  const [backupJson, setBackupJson] = useState('');
  const [backupPreview, setBackupPreview] = useState<LibraryRhythmBackupPreview | null>(null);
  const [backupErrors, setBackupErrors] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    loadCustomLibraryRhythms().then((savedRhythms) => {
      if (!active || savedRhythms.length === 0) return;

      const loadedRhythms = savedRhythms.map((rhythm) => rhythmFromTemplate(rhythm, false));

      setLibraryRhythms((current) => mergeRhythms(current, loadedRhythms));
      setEnabledById((current) => ({
        ...Object.fromEntries(loadedRhythms.map((rhythm) => [rhythm.id, false])),
        ...current,
      }));
    });

    return () => {
      active = false;
    };
  }, []);

  const filteredRhythms = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return libraryRhythms.filter((rhythm) => {
      const matchesCategory = activeCategory === 'All' || rhythm.category === activeCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        `${rhythm.title} ${rhythm.category} ${rhythm.purpose}`.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, libraryRhythms, searchTerm]);

  const groupedRhythms = useMemo(() => {
    return filteredRhythms.reduce<Record<string, LibraryRhythm[]>>((groups, rhythm) => {
      groups[rhythm.category] = [...(groups[rhythm.category] ?? []), rhythm];
      return groups;
    }, {});
  }, [filteredRhythms]);

  function clearFilters() {
    setActiveCategory('All');
    setSearchTerm('');
  }

  function toggleEnabled(rhythmId: string) {
    setEnabledById((current) => ({ ...current, [rhythmId]: !current[rhythmId] }));
  }

  async function addToToday(rhythm: LibraryRhythm) {
    const result = await saveActiveTodayTask(activeTaskFromLibraryRhythm(rhythm));

    if (!result.ok) {
      setConfirmation(`${rhythm.title} was not added to Today. Check the rhythm details.`);
      return;
    }

    if (result.alreadyExists) {
      setConfirmation(`${rhythm.title} is already in Today on this device.`);
      return;
    }

    setConfirmation(`${rhythm.title} saved to Today on this device. Library enablement did not change.`);
  }

  function enablePack(pack: QuickPack) {
    setEnabledById((current) => ({
      ...current,
      ...Object.fromEntries(pack.rhythmIds.map((rhythmId) => [rhythmId, true])),
    }));
    setConfirmation(`${pack.rhythmIds.length} rhythms enabled. Today only shows what fits.`);
  }

  async function exportSavedLibraryRhythms() {
    const backup = await exportLibraryRhythmBackup();

    if (!backup) {
      setConfirmation('No saved custom rhythms to export yet.');
      return;
    }

    downloadLibraryRhythmBackup(backup);
    setConfirmation('Library rhythms backup created on this device.');
  }

  function checkLibraryRhythmBackup() {
    const result = parseLibraryRhythmBackupJson(backupJson);

    if (result.ok) {
      setBackupErrors([]);
      setBackupPreview(result.preview);
      setConfirmation('Library rhythms backup looks valid. Restore is not connected yet.');
      return;
    }

    setBackupErrors(result.errors);
    setBackupPreview(null);
    setConfirmation('This Library rhythms backup could not be used.');
  }

  async function readLibraryRhythmBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) return;

    try {
      setBackupJson(await file.text());
      setBackupErrors([]);
      setBackupPreview(null);
      setConfirmation('Library rhythms backup loaded. Choose Check Library rhythms backup.');
    } catch {
      setBackupErrors(['backup: Library rhythms backup file could not be read.']);
      setBackupPreview(null);
      setConfirmation('This Library rhythms backup could not be used.');
    }
  }

  async function saveCreatedRhythm(input: CreateRhythmInput): Promise<boolean> {
    let result;

    try {
      const candidate = templateFromCreatedRhythm(input);
      result = await saveCustomLibraryRhythm(candidate);
    } catch {
      setConfirmation('Rhythm was not saved. Check the required fields.');
      return false;
    }

    if (!result.ok) {
      setConfirmation('Rhythm was not saved. Check the required fields.');
      return false;
    }

    const rhythm = rhythmFromTemplate(result.rhythm, input.enabled);

    setLibraryRhythms((current) => mergeRhythms(current, [rhythm]));
    setEnabledById((current) => ({ ...current, [rhythm.id]: input.enabled }));
    setActiveCategory(rhythm.category);
    setSearchTerm('');
    setConfirmation('Rhythm saved to Library on this device. Enablement and Add to Today are still preview-only.');
    setCreateRhythmOpen(false);
    return true;
  }

  return (
    <div className="screen-stack library-screen">
      <section className="library-hero" aria-labelledby="library-title">
        <p className="eyebrow">Rhythm catalogue</p>
        <h1 id="library-title">Library</h1>
        <p>Turn on rhythms when they are useful. Today only shows what fits.</p>
      </section>

      <Card>
        <section aria-labelledby="library-create-title" className="library-create-card">
          <div>
            <h2 id="library-create-title">Create reusable support</h2>
            <p>
              Create rhythm makes a reusable template. Add to Today now is only for a one-off today action.
              This backup includes saved custom Library rhythms only. It does not include Today tasks.
            </p>
          </div>
          <div className="library-create-card__actions">
            <Button onClick={() => setCreateRhythmOpen(true)} variant="primary">Create rhythm</Button>
            <Button onClick={exportSavedLibraryRhythms}>Export Library rhythms backup</Button>
            <Button disabled>Create pack later</Button>
          </div>
        </section>
      </Card>

      <Card>
        <section aria-labelledby="library-backup-check-title" className="library-backup-checker">
          <div className="library-subheading">
            <h2 id="library-backup-check-title">Check Library rhythms backup</h2>
            <p>Checking a backup does not change anything on this device. Restore is not connected yet.</p>
          </div>
          <label className="library-backup-field">
            <span>Library rhythm backup JSON</span>
            <textarea
              aria-label="Library rhythm backup JSON"
              onChange={(event) => {
                setBackupJson(event.target.value);
                setBackupErrors([]);
                setBackupPreview(null);
              }}
              placeholder="Paste a Library rhythms backup JSON file here."
              rows={6}
              value={backupJson}
            />
            <small>This checks saved custom Library rhythm backups only. It does not restore rhythms.</small>
          </label>
          <div className="library-backup-actions">
            <label className="library-file-picker">
              <span>Select Library backup file</span>
              <input
                accept="application/json,.json"
                aria-label="Select Library backup file"
                onChange={readLibraryRhythmBackupFile}
                type="file"
              />
            </label>
            <Button onClick={checkLibraryRhythmBackup}>Check Library rhythms backup</Button>
          </div>
          {backupPreview ? (
            <dl aria-label="Library rhythm backup preview" className="library-backup-preview">
              <div>
                <dt>Rhythms</dt>
                <dd>{backupPreview.rhythmCount}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{backupPreview.exportedAt}</dd>
              </div>
              <div>
                <dt>Titles</dt>
                <dd>{backupPreview.rhythmTitles.join(', ') || 'No rhythm titles in backup.'}</dd>
              </div>
            </dl>
          ) : null}
          {backupErrors.length > 0 ? (
            <div className="library-validation-summary">
              <strong>Backup check notes</strong>
              <p>Nothing changed on this device. The first items to review are below.</p>
              <ul aria-label="Library rhythm backup errors" className="library-validation-list">
                {backupErrors.slice(0, 3).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </Card>

      <Card>
        <div className="library-filters">
          <label>
            <span>Search rhythms</span>
            <input
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by rhythm, category, or purpose"
              type="search"
              value={searchTerm}
            />
          </label>
          <div aria-label="Library categories" className="library-category-row" role="list">
            {libraryCategories.map((category) => (
              <button
                aria-pressed={activeCategory === category}
                key={category}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {confirmation ? <p className="library-confirmation" role="status">{confirmation}</p> : null}

      <section className="quick-packs" aria-labelledby="quick-packs-title">
        <div className="section-heading">
          <h2 id="quick-packs-title">Quick packs</h2>
          <p>Preview first. Packs enable rhythms, not task piles.</p>
        </div>
        <div className="quick-pack-grid">
          {initialLibraryViewModel.quickPacks.map((pack) => (
            <QuickPackCard
              key={pack.id}
              onEnablePack={enablePack}
              onPreviewPack={(packId) => setPreviewPackId((current) => (current === packId ? null : packId))}
              pack={pack}
              previewOpen={previewPackId === pack.id}
              rhythms={libraryRhythms.filter((rhythm) => pack.rhythmIds.includes(rhythm.id))}
            />
          ))}
        </div>
      </section>

      {filteredRhythms.length > 0 ? (
        <div className="library-groups">
          {Object.entries(groupedRhythms).map(([category, rhythms]) => (
            <section aria-labelledby={`${category}-library-heading`} className="library-group" key={category}>
              <div className="section-heading">
                <h2 id={`${category}-library-heading`}>{category}</h2>
                <p>{rhythms.length} rhythm{rhythms.length === 1 ? '' : 's'} in this view.</p>
              </div>
              <div className="library-card-grid">
                {rhythms.map((rhythm) => (
                  <LibraryRhythmCard
                    enabled={Boolean(enabledById[rhythm.id])}
                    key={rhythm.id}
                    onAddToday={addToToday}
                    onToggleEnabled={toggleEnabled}
                    rhythm={rhythm}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          action={<Button onClick={clearFilters} variant="primary">Clear filters</Button>}
          message="Try another category or clear the search."
          title="No rhythms match this filter"
        />
      )}
      <CreateRhythmModal
        onClose={() => setCreateRhythmOpen(false)}
        onSave={saveCreatedRhythm}
        open={createRhythmOpen}
      />
    </div>
  );
}
