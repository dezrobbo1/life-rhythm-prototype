import { describe, expect, it } from 'vitest';
import { canonicalProjectionSchema, canonicalClassManifest } from './canonicalProjectionSchema';
const projection = () => ({
  protocolVersion: 1,
  schemaVersion: 1,
  classes: Object.fromEntries(canonicalClassManifest.map((key) => [key, { count: 0 }])),
});
describe('reserved canonical class manifest (no payload transport)', () => {
  it('requires every authority class and distinct settings sidecars', () => {
    expect(canonicalProjectionSchema.safeParse(projection()).success).toBe(true);
    const p = projection();
    delete p.classes.explicitPreferences;
    expect(canonicalProjectionSchema.safeParse(p).success).toBe(false);
  });
  it('rejects unknown derived/legacy classes', () =>
    expect(
      canonicalProjectionSchema.safeParse({
        ...projection(),
        classes: { ...projection().classes, schedulerPlanState: { count: 1 } },
      }).success,
    ).toBe(false));
  it('rejects real content and excessive class counts', () => {
    const p = projection();
    p.classes.activeTasks = { count: 10001 };
    expect(canonicalProjectionSchema.safeParse(p).success).toBe(false);
    expect(canonicalProjectionSchema.safeParse({ ...projection(), profile: {} }).success).toBe(
      false,
    );
  });
  it('bounds total records and version independently of Dexie/portable', () => {
    const p = projection();
    for (const key of canonicalClassManifest)
      if (!['settings', 'explicitPreferences', 'durationControls', 'calendarSource'].includes(key))
        p.classes[key] = { count: 1500 };
    expect(canonicalProjectionSchema.safeParse(p).success).toBe(false);
    expect(canonicalProjectionSchema.safeParse({ ...projection(), schemaVersion: 6 }).success).toBe(
      false,
    );
  });
});
