import { z } from 'zod';
/** C1 inventory contract only. No serializer, content endpoint or C2 migration/hydration adapter. */
export const canonicalClassManifest = [
  'settings',
  'explicitPreferences',
  'durationControls',
  'rhythmTemplates',
  'rhythmPlans',
  'rhythmRecurrenceRevisions',
  'rhythmInstances',
  'activeTasks',
  'taskPoolItems',
  'softPlacements',
  'behaviourEvents',
  'calendarSource',
  'routedRhythmPlacements',
] as const;
const singletonClasses = new Set<string>([
  'settings',
  'explicitPreferences',
  'durationControls',
  'calendarSource',
]);
const countSchema = z.object({ count: z.number().int().nonnegative().max(10000) }).strict();
const classShape = Object.fromEntries(
  canonicalClassManifest.map((key) => [
    key,
    singletonClasses.has(key)
      ? countSchema.extend({ count: z.number().int().min(0).max(1) })
      : countSchema,
  ]),
) as Record<(typeof canonicalClassManifest)[number], typeof countSchema>;
export const canonicalProjectionSchema = z
  .object({
    protocolVersion: z.literal(1),
    schemaVersion: z.literal(1),
    classes: z.object(classShape).strict(),
  })
  .strict()
  .refine(
    (value) => Object.values(value.classes).reduce((sum, row) => sum + row.count, 0) <= 10000,
    'Inventory exceeds record bounds.',
  );
export type CanonicalProjectionManifest = z.infer<typeof canonicalProjectionSchema>;
