import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button, Card, EmptyState, ScreenHero } from '../components';
import { rhythmTemplateSchema, type RhythmTemplate } from '../data/schemas';
import type { RhythmPlan, RhythmRecurrenceRevision } from '../data/rhythmAuthoritySchemas';
import {
  loadRhythmAuthorityResult,
  saveRhythmConfiguration,
  setRhythmPlanState,
} from '../data/rhythmAuthorityRepository';
import { ensureCurrentPrivatePlan } from '../data/schedulerPlanCoordinator';
import { addRhythmToTodayOnce } from '../data/rhythmTodayRepository';
import {
  exportRhythmAuthorityBackup,
  parseRhythmAuthorityBackupJson,
  type RhythmAuthorityBackupPreview,
} from '../data/rhythmAuthorityBackup';
import { CreateRhythmModal, type CreateRhythmInput, type RhythmFormInitial } from '../features/library/CreateRhythmModal';
import { LibraryRhythmCard, type LibraryRhythmConfigurationView } from '../features/library/LibraryRhythmCard';
import { QuickPackCard } from '../features/library/QuickPackCard';
import {
  libraryCategories,
  mockLibraryRhythms,
  mockQuickPacks,
  type LibraryCategory,
  type LibraryRhythm,
} from '../features/library/mockLibraryData';

type RhythmArea = RhythmTemplate['area'];
type AuthorityState =
  | { status: 'loading' }
  | { status: 'error'; errors: string[] }
  | {
      status: 'ok';
      templates: RhythmTemplate[];
      plans: RhythmPlan[];
      revisions: RhythmRecurrenceRevision[];
    };
type ConfigTarget = { mode: 'create' } | { mode: 'configure' | 'edit'; rhythm: LibraryRhythm };

const categoryToArea: Record<LibraryRhythm['category'], RhythmArea> = {
  'Anti-scroll': 'antidrift', 'Emotional recovery': 'emotion', Food: 'food', Household: 'house',
  Money: 'money', Motivation: 'other', Movement: 'movement', 'Sensory load': 'sensory', Sleep: 'health',
  'Social support': 'social', 'Start Boost': 'other', 'Work focus': 'work',
};
const areaToCategory: Record<RhythmArea, LibraryRhythm['category']> = {
  admin: 'Household', antidrift: 'Anti-scroll', emotion: 'Emotional recovery', food: 'Food', health: 'Sleep',
  house: 'Household', money: 'Money', movement: 'Movement', other: 'Motivation', sensory: 'Sensory load',
  social: 'Social support', work: 'Work focus',
};
const areaToTaskType: Record<RhythmArea, RhythmTemplate['taskType']> = {
  admin: 'admin', antidrift: 'simple', emotion: 'emotion', food: 'food', health: 'simple', house: 'house',
  money: 'admin', movement: 'exercise', other: 'simple', sensory: 'sensory', social: 'social', work: 'work',
};

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'rhythm';
}

function newCustomId(title: string) {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString();
  return `custom-${safeSlug(title)}-${suffix}`;
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function rhythmFromTemplate(template: RhythmTemplate): LibraryRhythm {
  const builtIn = mockLibraryRhythms.find((rhythm) => rhythm.id === template.id);
  return {
    boundaryNote: builtIn?.boundaryNote ?? 'This reusable rhythm remains under your control.',
    category: areaToCategory[template.area],
    categoryNote: builtIn?.categoryNote ?? 'Keep it optional, inspectable, and easy to pause.',
    chips: builtIn?.chips ?? ['Custom', 'Configured'],
    fullVersion: template.full.label,
    id: template.id,
    minimumVersion: template.minimum.label,
    normalVersion: template.normal.label,
    packIds: builtIn?.packIds ?? [],
    purpose: template.purpose ?? builtIn?.purpose ?? 'Reusable support configured by you.',
    recommendedSize: `${template.minimum.minutes}/${template.normal.minutes}/${template.full.minutes} min`,
    title: template.title,
    whyThisExists: builtIn?.whyThisExists ?? 'This custom rhythm was created by you.',
  };
}

function templateFromInput(
  input: CreateRhythmInput,
  rhythm: LibraryRhythm | undefined,
  existing: RhythmTemplate | undefined,
) {
  const now = new Date().toISOString();
  const area = categoryToArea[input.category];
  return rhythmTemplateSchema.parse({
    ...(existing ?? {}),
    id: existing?.id ?? rhythm?.id ?? newCustomId(input.title),
    source: existing?.source ?? (rhythm ? 'built-in' : 'custom'),
    title: input.title,
    area,
    taskType: existing?.taskType ?? areaToTaskType[area],
    kind: 'repeating',
    completionStyle: existing?.completionStyle ?? 'flexible',
    priority: existing?.priority ?? 'normal',
    energy: existing?.energy ?? 'medium',
    startBarrier: existing?.startBarrier ?? 'unclear',
    purpose: input.purpose || undefined,
    minimum: { label: input.minimumAction, minutes: input.minimumMinutes },
    normal: { label: input.normalAction, minutes: input.normalMinutes },
    full: { label: input.fullAction, minutes: input.fullMinutes },
    schedule: {
      ...(existing?.schedule ?? {}),
      frequency: input.frequency,
      period: input.period,
      preferredDays: input.preferredDays,
      bestTime: input.preferredTime,
      maxPerDay: input.maxPerDay,
      catchupAllowed: false,
    },
    enabled: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

function downloadJson(fileName: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function LibraryScreen() {
  const [authority, setAuthority] = useState<AuthorityState>({ status: 'loading' });
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [configTarget, setConfigTarget] = useState<ConfigTarget | null>(null);
  const [previewPackId, setPreviewPackId] = useState<string | null>(null);
  const [backupJson, setBackupJson] = useState('');
  const [backupPreview, setBackupPreview] = useState<RhythmAuthorityBackupPreview | null>(null);
  const [backupErrors, setBackupErrors] = useState<string[]>([]);

  async function reloadAuthority() {
    const result = await loadRhythmAuthorityResult();
    if (result.status !== 'ok') {
      setAuthority({ status: 'error', errors: result.errors });
      return false;
    }
    setAuthority({ status: 'ok', templates: result.templates, plans: result.plans, revisions: result.revisions });
    return true;
  }

  useEffect(() => { void reloadAuthority(); }, []);

  const templateById = useMemo(() => new Map(
    authority.status === 'ok' ? authority.templates.map((template) => [template.id, template]) : [],
  ), [authority]);
  const planByTemplateId = useMemo(() => new Map(
    authority.status === 'ok' ? authority.plans.map((plan) => [plan.rhythmTemplateId, plan]) : [],
  ), [authority]);
  const revisionById = useMemo(() => new Map(
    authority.status === 'ok' ? authority.revisions.map((revision) => [revision.id, revision]) : [],
  ), [authority]);
  const libraryRhythms = useMemo(() => {
    const builtInIds = new Set(mockLibraryRhythms.map((rhythm) => rhythm.id));
    const builtIns = mockLibraryRhythms.map((rhythm) => {
      const configured = templateById.get(rhythm.id);
      return configured ? rhythmFromTemplate(configured) : rhythm;
    });
    const custom = authority.status === 'ok'
      ? authority.templates.filter((template) => !builtInIds.has(template.id)).map(rhythmFromTemplate)
      : [];
    return [...custom, ...builtIns];
  }, [authority, templateById]);

  function configurationFor(rhythmId: string): LibraryRhythmConfigurationView {
    const template = templateById.get(rhythmId);
    const plan = planByTemplateId.get(rhythmId);
    const revision = plan ? revisionById.get(plan.latestRecurrenceRevisionId) : undefined;
    if (!template || !plan || !revision) return { state: 'unconfigured' };
    return {
      state: plan.state,
      frequency: revision.rule.frequency,
      period: revision.rule.period,
      minimumMinutes: template.minimum.minutes,
      normalMinutes: template.normal.minutes,
      fullMinutes: template.full.minutes,
      preferredDays: revision.rule.preferredDays,
      preferredTime: plan.preferredTime,
    };
  }

  function openConfiguration(rhythm: LibraryRhythm) {
    setConfigTarget({ mode: planByTemplateId.has(rhythm.id) ? 'edit' : 'configure', rhythm });
  }

  function formInitial(): RhythmFormInitial {
    if (!configTarget || configTarget.mode === 'create') return {};
    const rhythm = configTarget.rhythm;
    const template = templateById.get(rhythm.id);
    const plan = planByTemplateId.get(rhythm.id);
    const revision = plan ? revisionById.get(plan.latestRecurrenceRevisionId) : undefined;
    return {
      title: template?.title ?? rhythm.title,
      category: template ? areaToCategory[template.area] : rhythm.category,
      purpose: template?.purpose ?? rhythm.purpose,
      minimumAction: template?.minimum.label ?? rhythm.minimumVersion,
      minimumMinutes: template?.minimum.minutes,
      normalAction: template?.normal.label,
      normalMinutes: template?.normal.minutes,
      fullAction: template?.full.label,
      fullMinutes: template?.full.minutes,
      frequency: revision?.rule.frequency ?? 1,
      period: revision?.rule.period ?? 'week',
      preferredDays: revision?.rule.preferredDays ?? [],
      preferredTime: plan?.preferredTime ?? 'anytime',
      maxPerDay: revision?.rule.maxPerDay ?? 1,
      effectiveFromLocalDate: localDate(),
      turnOn: plan ? plan.state !== 'disabled' : true,
    };
  }

  async function saveConfiguration(input: CreateRhythmInput) {
    const rhythm = configTarget && configTarget.mode !== 'create' ? configTarget.rhythm : undefined;
    const existing = rhythm ? templateById.get(rhythm.id) : undefined;
    const currentPlan = rhythm ? planByTemplateId.get(rhythm.id) : undefined;
    const template = templateFromInput(input, rhythm, existing);
    const result = await saveRhythmConfiguration({
      template,
      state: input.turnOn ? (currentPlan?.state === 'paused' ? 'paused' : 'enabled') : 'disabled',
      frequency: input.frequency,
      period: input.period,
      preferredDays: input.preferredDays,
      preferredTime: input.preferredTime,
      maxPerDay: input.maxPerDay,
      timezone: input.timezone,
      effectiveFromLocalDate: input.effectiveFromLocalDate,
    });
    if (!result.ok) {
      setConfirmation(`Rhythm was not saved. ${result.errors.join(' ')}`);
      return false;
    }
    const reconciled = await ensureCurrentPrivatePlan();
    await reloadAuthority();
    setConfigTarget(null);
    setActiveCategory(input.category);
    setSearchTerm('');
    setConfirmation(reconciled.ok
      ? `${input.title} saved. ${result.plan.state === 'enabled' ? 'The rhythm is on.' : result.plan.state === 'paused' ? 'The rhythm remains paused.' : 'The rhythm is off.'}`
      : `${input.title} saved. The private plan still needs repair.`);
    return true;
  }

  async function changeState(rhythmId: string, state: 'enabled' | 'paused' | 'disabled') {
    const result = await setRhythmPlanState(rhythmId, state);
    if (!result.ok) {
      setConfirmation(result.errors.join(' '));
      return;
    }
    const reconciled = await ensureCurrentPrivatePlan();
    await reloadAuthority();
    setConfirmation(reconciled.ok
      ? `Rhythm ${state === 'enabled' ? 'turned on' : state === 'paused' ? 'paused' : 'turned off'}.`
      : `Rhythm state saved. The private plan still needs repair.`);
  }

  async function addToToday(rhythm: LibraryRhythm) {
    if (!templateById.has(rhythm.id) || !planByTemplateId.has(rhythm.id)) {
      setConfirmation('Choose truthful action minutes before adding this rhythm to Today.');
      openConfiguration(rhythm);
      return;
    }
    const result = await addRhythmToTodayOnce(rhythm.id, localDate());
    if (!result.ok) {
      setConfirmation(result.errors.join(' '));
      return;
    }
    await ensureCurrentPrivatePlan();
    setConfirmation(result.alreadyExists
      ? `${rhythm.title} is already in Today.`
      : result.reusedGeneratedOccurrence
        ? `${rhythm.title} is in Today as the current rhythm occurrence.`
        : `${rhythm.title} was added once. Recurrence did not change.`);
  }

  async function exportBackup() {
    try {
      const backup = await exportRhythmAuthorityBackup();
      downloadJson(backup.fileName, backup.json);
      setConfirmation('Rhythm authority backup created. Restore remains unavailable.');
    } catch {
      setConfirmation('Rhythm authority backup could not be created because saved rhythm data are not fully readable.');
    }
  }

  function checkBackup() {
    const result = parseRhythmAuthorityBackupJson(backupJson);
    if (!result.ok) {
      setBackupErrors(result.errors);
      setBackupPreview(null);
      return;
    }
    setBackupErrors([]);
    setBackupPreview(result.preview);
  }

  async function readBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) setBackupJson(await file.text());
  }

  const filtered = libraryRhythms.filter((rhythm) => {
    const search = searchTerm.trim().toLowerCase();
    return (activeCategory === 'All' || rhythm.category === activeCategory) &&
      (!search || `${rhythm.title} ${rhythm.category} ${rhythm.purpose}`.toLowerCase().includes(search));
  });
  const grouped = filtered.reduce<Partial<Record<LibraryRhythm['category'], LibraryRhythm[]>>>((groups, rhythm) => {
    groups[rhythm.category] = [...(groups[rhythm.category] ?? []), rhythm];
    return groups;
  }, {});

  return <div className="screen-stack library-screen">
    <ScreenHero className="library-hero" eyebrow="Rhythm catalogue" tagline="Configure real minutes and a flexible frequency, then keep the rhythm under your control." title="Library" titleId="library-title" />
    <Card><section aria-labelledby="library-create-title" className="library-create-card"><div><h2 id="library-create-title">Reusable support</h2><p>Catalogue rhythms are suggestions. They become personal scheduling input only after you configure them.</p></div><div className="library-create-card__actions"><Button disabled={authority.status !== 'ok'} onClick={() => setConfigTarget({ mode: 'create' })} variant="primary">Create rhythm</Button><Button disabled={authority.status !== 'ok'} onClick={() => { void exportBackup(); }}>Export rhythm backup</Button></div></section></Card>
    {authority.status === 'loading' ? <div aria-busy="true" className="surface-read-state" role="status"><h2>Reading saved rhythm configuration...</h2></div> : authority.status === 'error' ? <div className="surface-read-state surface-read-state--error" role="alert"><h2>Saved rhythm configuration could not be read.</h2><p>Catalogue suggestions remain visible, but configuration and scheduling are unavailable until the saved data can be read safely.</p><Button onClick={() => { setAuthority({ status: 'loading' }); void reloadAuthority(); }}>Retry</Button></div> : null}
    <Card><section aria-labelledby="rhythm-backup-check-title" className="library-backup-checker"><div className="library-subheading"><h2 id="rhythm-backup-check-title">Check rhythm backup</h2><p>Validation only. Restore is not connected.</p></div><label className="library-backup-field"><span>Paste backup text</span><textarea onChange={(event) => { setBackupJson(event.target.value); setBackupPreview(null); setBackupErrors([]); }} rows={5} value={backupJson} /></label><div className="library-backup-actions"><label className="library-file-picker"><span>Select backup file</span><input accept="application/json,.json" onChange={(event) => { void readBackupFile(event); }} type="file" /></label><Button onClick={checkBackup}>Check rhythm backup</Button></div>{backupPreview ? <p role="status">Valid backup: {backupPreview.templateCount} templates, {backupPreview.planCount} plans, {backupPreview.instanceCount} occurrences. Dependencies: {backupPreview.dependencyState}.</p> : null}{backupErrors.length ? <div role="alert"><ul>{backupErrors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}</ul></div> : null}</section></Card>
    <Card><div className="library-filters"><label><span>Search rhythms</span><input onChange={(event) => setSearchTerm(event.target.value)} type="search" value={searchTerm} /></label><div aria-label="Library categories" className="library-category-row" role="list">{libraryCategories.map((category) => <button aria-pressed={activeCategory === category} key={category} onClick={() => setActiveCategory(category)} type="button">{category}</button>)}</div></div></Card>
    {confirmation ? <p className="library-confirmation" role="status">{confirmation}</p> : null}
    <section className="quick-packs" aria-labelledby="quick-packs-title"><div className="section-heading"><h2 id="quick-packs-title">Quick packs</h2><p>Preview-only collections. Configure rhythms individually.</p></div><div className="quick-pack-grid">{mockQuickPacks.map((pack) => <QuickPackCard key={pack.id} onPreviewPack={(id) => setPreviewPackId((current) => current === id ? null : id)} pack={pack} previewOpen={previewPackId === pack.id} rhythms={libraryRhythms.filter((rhythm) => pack.rhythmIds.includes(rhythm.id))} />)}</div></section>
    {filtered.length ? <div className="library-groups">{Object.entries(grouped).map(([category, rhythms]) => rhythms ? <section aria-labelledby={`${category}-library-heading`} className="library-group" key={category}><div className="section-heading"><h2 id={`${category}-library-heading`}>{category}</h2><p>{rhythms.length} rhythm{rhythms.length === 1 ? '' : 's'} in this view.</p></div><div className="library-card-grid">{rhythms.map((rhythm) => <LibraryRhythmCard configuration={configurationFor(rhythm.id)} key={rhythm.id} onAddToday={(item) => { void addToToday(item); }} onConfigure={openConfiguration} onSetState={(id, state) => { void changeState(id, state); }} rhythm={rhythm} />)}</div></section> : null)}</div> : <EmptyState action={<Button onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}>Clear filters</Button>} message="Try another category or clear the search." title="No rhythms match this filter" />}
    {configTarget ? <CreateRhythmModal initial={formInitial()} key={`${configTarget.mode}:${configTarget.mode === 'create' ? 'new' : configTarget.rhythm.id}`} mode={configTarget.mode} onClose={() => setConfigTarget(null)} onSave={saveConfiguration} open /> : null}
  </div>;
}
