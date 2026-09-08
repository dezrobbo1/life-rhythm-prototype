import { describe, expect, it } from 'vitest';
import { assessTaskReentry, type TaskReentryInput } from './taskReentry';

const now = '2026-09-08T04:00:00.000Z';

function task(overrides: Partial<TaskReentryInput> = {}): TaskReentryInput {
  return {
    minimum: { label: 'Open the form.', minutes: 5 },
    missedPolicy: 'ask',
    status: 'active',
    ...overrides,
  };
}

describe('task re-entry assessment', () => {
  it('does not invent a review for flexible work or edges that have not passed', () => {
    expect(assessTaskReentry(task({ timeConstraint: 'flexible' }), now).needsReview).toBe(false);
    expect(assessTaskReentry(task({
      dueAt: '2026-09-08T05:00:00.000Z',
      timeConstraint: 'dueBy',
    }), now).needsReview).toBe(false);
  });

  it('offers Minimum after a passed due edge only when authored data says it remains useful', () => {
    const useful = assessTaskReentry(task({
      dueAt: '2026-09-08T03:00:00.000Z',
      minimumStillUsefulAfterDeadline: true,
      timeConstraint: 'dueBy',
    }), now);
    const notUseful = assessTaskReentry(task({
      dueAt: '2026-09-08T03:00:00.000Z',
      minimumStillUsefulAfterDeadline: false,
      timeConstraint: 'dueBy',
    }), now);

    expect(useful).toMatchObject({
      minimumStillUseful: true,
      state: 'dueEdgePassed',
      validActions: ['tryMinimum', 'park', 'notToday', 'reviewLater'],
    });
    expect(notUseful.minimumStillUseful).toBe(false);
    expect(notUseful.validActions).not.toContain('tryMinimum');
  });

  it('distinguishes narrowed, expired, no-longer-useful, and fixed opportunity states', () => {
    expect(assessTaskReentry(task({
      latestUsefulStartAt: '2026-09-08T03:00:00.000Z',
      notUsefulAfter: '2026-09-08T05:00:00.000Z',
    }), now).state).toBe('latestUsefulStartPassed');
    expect(assessTaskReentry(task({
      notUsefulAfter: '2026-09-08T03:00:00.000Z',
    }), now).state).toBe('notUsefulAnymore');
    expect(assessTaskReentry(task({
      expiresAfter: '2026-09-08T03:00:00.000Z',
      timeConstraint: 'expiresAfter',
    }), now).state).toBe('expired');
    const fixed = assessTaskReentry(task({
      fixedAt: '2026-09-08T03:00:00.000Z',
      timeConstraint: 'fixedAt',
    }), now);
    expect(fixed.state).toBe('fixedOpportunityPassed');
    expect(fixed.usefulness).toBe('It has not been converted into flexible work.');
  });

  it('fails safely for invalid or missing optional instants', () => {
    expect(assessTaskReentry(task({ dueAt: 'invalid', timeConstraint: 'dueBy' }), now).needsReview).toBe(false);
    expect(assessTaskReentry(task({ timeConstraint: 'dueBy' }), now).needsReview).toBe(false);
    expect(assessTaskReentry(task(), 'invalid').needsReview).toBe(false);
  });

  it.each([
    ['ask', undefined],
    ['park', 'park'],
    ['notToday', 'notToday'],
    ['followUpPrompt', 'reviewLater'],
    ['hideUntilReview', 'park'],
  ] as const)('maps %s policy to a recommendation without executing it', (missedPolicy, recommendedAction) => {
    const result = assessTaskReentry(task({
      dueAt: '2026-09-08T03:00:00.000Z',
      missedPolicy,
      timeConstraint: 'dueBy',
    }), now);

    expect(result.recommendedAction).toBe(recommendedAction);
  });

  it('recommends minimumOnly only while Minimum is genuinely useful', () => {
    const useful = assessTaskReentry(task({
      dueAt: '2026-09-08T03:00:00.000Z',
      minimumStillUsefulAfterDeadline: true,
      missedPolicy: 'minimumOnly',
      timeConstraint: 'dueBy',
    }), now);
    const expired = assessTaskReentry(task({
      expiresAfter: '2026-09-08T03:00:00.000Z',
      minimumStillUsefulAfterDeadline: true,
      missedPolicy: 'minimumOnly',
      timeConstraint: 'expiresAfter',
    }), now);

    expect(useful.recommendedAction).toBe('tryMinimum');
    expect(expired.recommendedAction).toBeUndefined();
    expect(expired.validActions).not.toContain('tryMinimum');
  });

  it('offers archiveIfExpired only after a terminal usefulness edge and only for supported linked tasks', () => {
    const beforeExpiry = assessTaskReentry(task({
      latestUsefulStartAt: '2026-09-08T03:00:00.000Z',
      missedPolicy: 'archiveIfExpired',
      noLongerNeededSupported: true,
      notUsefulAfter: '2026-09-08T05:00:00.000Z',
    }), now);
    const unsupported = assessTaskReentry(task({
      expiresAfter: '2026-09-08T03:00:00.000Z',
      missedPolicy: 'archiveIfExpired',
      timeConstraint: 'expiresAfter',
    }), now);
    const supported = assessTaskReentry(task({
      expiresAfter: '2026-09-08T03:00:00.000Z',
      missedPolicy: 'archiveIfExpired',
      noLongerNeededSupported: true,
      timeConstraint: 'expiresAfter',
    }), now);

    expect(beforeExpiry.validActions).not.toContain('noLongerNeeded');
    expect(unsupported.validActions).not.toContain('noLongerNeeded');
    expect(supported).toMatchObject({ recommendedAction: 'noLongerNeeded' });
    expect(supported.validActions).toContain('noLongerNeeded');
  });

  it('does not interrupt in-flight work or re-offer an achieved Minimum', () => {
    for (const status of ['inProgress', 'paused', 'minimumDone'] as const) {
      expect(assessTaskReentry(task({
        dueAt: '2026-09-08T03:00:00.000Z',
        minimumStillUsefulAfterDeadline: true,
        status,
        timeConstraint: 'dueBy',
      }), now).needsReview).toBe(false);
    }

    const achieved = assessTaskReentry(task({
      dueAt: '2026-09-08T03:00:00.000Z',
      minimumAchieved: true,
      minimumStillUsefulAfterDeadline: true,
      timeConstraint: 'dueBy',
    }), now);
    expect(achieved.validActions).not.toContain('tryMinimum');
  });

  it('is deterministic and does not mutate its input', () => {
    const input = task({
      dueAt: '2026-09-08T03:00:00.000Z',
      minimumStillUsefulAfterDeadline: true,
      timeConstraint: 'dueBy',
    });
    const before = structuredClone(input);

    expect(assessTaskReentry(input, now)).toEqual(assessTaskReentry(input, now));
    expect(input).toEqual(before);
  });
});
