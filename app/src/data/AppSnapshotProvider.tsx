import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  getFallbackAppSnapshot,
  loadReadOnlyAppSnapshot,
  type LoadReadOnlyAppSnapshotInput,
} from './readOnlyAdapter';
import {
  normalDayWithOneTaskSnapshot,
  type AppDataSnapshot,
} from '../viewModels';

export type AppSnapshotSource = 'personal' | 'fixture' | 'fallback' | 'read-only adapter';

export type AppSnapshotContextValue = {
  error: Error | null;
  loading: boolean;
  snapshot: AppDataSnapshot;
  source: AppSnapshotSource;
};

type AppSnapshotProviderProps = {
  adapterInput?: LoadReadOnlyAppSnapshotInput;
  children: ReactNode;
  snapshot?: AppDataSnapshot;
  source?: AppSnapshotSource;
};

const defaultContextValue: AppSnapshotContextValue = {
  error: null,
  loading: false,
  snapshot: getFallbackAppSnapshot(normalDayWithOneTaskSnapshot),
  source: 'fixture',
};

const AppSnapshotContext = createContext<AppSnapshotContextValue>(defaultContextValue);

function hasAdapterInput(input: LoadReadOnlyAppSnapshotInput | undefined): boolean {
  return Boolean(input?.currentData || input?.legacySnapshot !== undefined);
}

export function AppSnapshotProvider({
  adapterInput,
  children,
  snapshot,
  source,
}: AppSnapshotProviderProps) {
  const value = useMemo<AppSnapshotContextValue>(() => {
    if (snapshot) {
      return {
        error: null,
        loading: false,
        snapshot,
        source: source ?? 'fixture',
      };
    }

    const hasReadableInput = hasAdapterInput(adapterInput);

    return {
      error: null,
      loading: false,
      snapshot: loadReadOnlyAppSnapshot({
        ...adapterInput,
        fallbackSnapshot: adapterInput?.fallbackSnapshot ?? normalDayWithOneTaskSnapshot,
      }),
      source: source ?? (hasReadableInput ? 'read-only adapter' : 'fixture'),
    };
  }, [adapterInput, snapshot, source]);

  return (
    <AppSnapshotContext.Provider value={value}>
      {children}
    </AppSnapshotContext.Provider>
  );
}

export function useAppSnapshot() {
  return useContext(AppSnapshotContext);
}
