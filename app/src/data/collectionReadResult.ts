export type CollectionReadResult<T> =
  | {
      invalidRecordCount: number;
      items: T[];
      status: 'ok' | 'partial';
    }
  | {
      errors: string[];
      status: 'readFailed';
    };

export function successfulCollectionRead<T>(
  items: T[],
  invalidRecordCount: number,
): CollectionReadResult<T> {
  return {
    invalidRecordCount,
    items,
    status: invalidRecordCount > 0 ? 'partial' : 'ok',
  };
}
