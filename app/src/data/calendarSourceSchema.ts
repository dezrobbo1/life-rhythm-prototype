import { z } from 'zod';
import { strictIsoDateTimeSchema } from './schemas';

export const CURRENT_CALENDAR_SOURCE_ID = 'primary';

export const calendarSourceRecordSchema = z
  .object({
    id: z.literal(CURRENT_CALENDAR_SOURCE_ID),
    version: z.literal(1),
    adapterId: z.literal('ics'),
    label: z.string().trim().min(1).max(200),
    source: z.string().min(1).max(5_000_000),
    importedAt: strictIsoDateTimeSchema,
    updatedAt: strictIsoDateTimeSchema,
  })
  .strict();

export type CalendarSourceRecord = z.infer<typeof calendarSourceRecordSchema>;
