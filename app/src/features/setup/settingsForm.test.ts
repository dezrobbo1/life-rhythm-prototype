import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../../data/settingsRepository';
import { lifeShapeStateFromSettings, normalizeLifeShapeForm } from './settingsForm';

describe('Setup scheduling context round trip', () => {
  it('retains non-standard workdays and structured fixed commitments on an unrelated save', () => {
    const base = createDefaultSettings();
    const settings = {
      ...base,
      lifeShape: {
        ...base.lifeShape,
        usualWorkHours: { days: ['Tuesday', 'Thursday', 'Saturday'] as typeof base.workDays, start: '09:00', end: '17:00' },
        fixedCommitments: [{ id: 'school', label: 'School run', days: ['Tuesday'] as typeof base.workDays, start: '08:00', end: '08:30', travelMinutes: 15, bufferMinutes: 10 }],
      },
    };
    const draft = lifeShapeStateFromSettings(settings);
    const saved = normalizeLifeShapeForm({ ...draft, breakfastAnchor: '07:15' }, settings.lifeShape);
    expect(saved.usualWorkHours.days).toEqual(['Tuesday', 'Thursday', 'Saturday']);
    expect(saved.fixedCommitments).toEqual(settings.lifeShape.fixedCommitments);
  });
});
