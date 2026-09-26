import { describe, expect, it } from 'vitest';
import { rhythmTemplateSchema } from './schemas';
import { buildMissingRhythmInstances } from '../domain/rhythmRecurrence';
import { rhythmPlanSchema, rhythmRecurrenceRevisionSchema } from './rhythmAuthoritySchemas';
import {
  RHYTHM_AUTHORITY_BACKUP_FORMAT,
  RHYTHM_AUTHORITY_BACKUP_VERSION,
  parseRhythmAuthorityBackupJson,
} from './rhythmAuthorityBackup';

const timestamp = '2026-09-25T00:00:00.000Z';
const template = rhythmTemplateSchema.parse({
  id: 'backup-rhythm', source: 'custom', title: 'Backup rhythm', area: 'house',
  minimum: { label: 'Do it', minutes: 7 }, normal: { label: 'Do it', minutes: 7 },
  full: { label: 'Do it', minutes: 7 }, enabled: false, createdAt: timestamp, updatedAt: timestamp,
});

function payload() {
  return {
    format: RHYTHM_AUTHORITY_BACKUP_FORMAT,
    version: RHYTHM_AUTHORITY_BACKUP_VERSION,
    exportedAt: timestamp,
    templates: [template],
    plans: [{
      id: 'plan', rhythmTemplateId: template.id, state: 'enabled', latestRecurrenceRevisionId: 'revision',
      initialEffectiveFromLocalDate: '2026-09-25', preferredTime: 'anytime', timezone: 'UTC',
      missedOccurrencePolicy: 'skip', planningMode: 'automaticPrivate', createdAt: timestamp, updatedAt: timestamp,
    }],
    revisions: [{
      id: 'revision', rhythmPlanId: 'plan', revisionNumber: 1, effectiveFromLocalDate: '2026-09-25',
      timezone: 'UTC', rule: { frequency: 1, period: 'week', preferredDays: [], maxPerDay: 1 }, createdAt: timestamp,
    }],
    instances: [],
    activeTasks: [],
    behaviourEvents: [],
  };
}

describe('rhythm authority backup checker', () => {
  it('accepts a complete referential export', () => {
    const result = parseRhythmAuthorityBackupJson(JSON.stringify(payload()));
    expect(result).toMatchObject({ ok: true, preview: { dependencyState: 'complete', templateCount: 1, planCount: 1 } });
  });

  it('reports missing companion classes as unverified', () => {
    const {
      plans: _plans,
      revisions: _revisions,
      instances: _instances,
      activeTasks: _activeTasks,
      behaviourEvents: _behaviourEvents,
      ...templatesOnly
    } = payload();
    const result = parseRhythmAuthorityBackupJson(JSON.stringify(templatesOnly));
    expect(result).toMatchObject({ ok: true, preview: { dependencyState: 'unverified' } });
  });

  it('rejects duplicate IDs', () => {
    const value = payload();
    value.templates.push(template);
    const result = parseRhythmAuthorityBackupJson(JSON.stringify(value));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('Duplicate ID');
  });

  it('rejects duplicate canonical ownership even when row IDs differ', () => {
    const value = payload();
    value.plans.push({ ...value.plans[0], id: 'second-plan' });
    const result = parseRhythmAuthorityBackupJson(JSON.stringify(value));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('Duplicate canonical identity');
  });

  it('rejects broken cross-class references when companions are present', () => {
    const value = payload();
    value.plans[0].latestRecurrenceRevisionId = 'missing';
    const result = parseRhythmAuthorityBackupJson(JSON.stringify(value));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('Latest recurrence revision is missing');
  });

  it('checks an event instance ID alone when templateId is omitted, and rejects conflicting references', () => {
    const value = payload();
    const instance = buildMissingRhythmInstances({
      template,
      plan: rhythmPlanSchema.parse(value.plans[0]),
      revisions: [rhythmRecurrenceRevisionSchema.parse(value.revisions[0])],
      existing: [], horizonStartDate: '2026-09-25', horizonEndDate: '2026-09-25', createdAt: timestamp,
    })[0];
    expect(instance).toBeDefined();
    // The event schema allows occurrence identity without a template reference.
    const event = {
      recordKind: 'behaviourEvent', version: 1, id: 'event-1', eventType: 'taskStarted',
      occurredAt: timestamp, localDate: '2026-09-25', timezone: 'UTC',
      taskId: 'today-projection', rhythmInstanceId: instance.id,
      source: 'user', action: 'start',
      provenance: { origin: 'userAction', mechanism: 'taskLifecycle' },
      before: { taskStatus: 'active', minimumAchieved: false },
      after: { taskStatus: 'inProgress', minimumAchieved: false },
    };
    const check = (reference: { templateId?: string; rhythmInstanceId: string }) => parseRhythmAuthorityBackupJson(JSON.stringify({
      ...value, instances: [instance], behaviourEvents: [{ ...event, ...reference }],
    }));
    expect(check({ rhythmInstanceId: instance.id, templateId: template.id }).ok).toBe(true);
    expect(check({ rhythmInstanceId: instance.id }).ok).toBe(true);
    const conflicting = check({ rhythmInstanceId: instance.id, templateId: 'different-template' });
    expect(conflicting.ok).toBe(false);
    if (!conflicting.ok) expect(conflicting.errors.join(' ')).toContain('Referenced rhythm occurrence is missing');
    const missing = check({ rhythmInstanceId: 'missing-instance' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.join(' ')).toContain('Referenced rhythm occurrence is missing');
  });

  it('rejects malformed JSON without executing restore', () => {
    expect(parseRhythmAuthorityBackupJson('{ bad')).toEqual({ ok: false, errors: ['Backup JSON is malformed.'] });
  });
});
