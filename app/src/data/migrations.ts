// Future migrations must inspect old localStorage keys without mutating them first.
export type MigrationStatus = 'not-started';

export const migrationStatus: MigrationStatus = 'not-started';

