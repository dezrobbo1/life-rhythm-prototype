import { useSessionAuth } from './SupabaseSessionProvider';
import { useLayoutEffect, useState, type ReactNode } from 'react';
import {
  createAuthLocalDataNamespace,
  getLegacyLocalDataNamespace,
  resetCurrentLocalDataNamespace,
  setCurrentLocalDataNamespace,
  type LocalDataNamespace,
} from '../data/localDataNamespace';

type NamespaceBoundaryProps = {
  children: ReactNode;
  namespace: LocalDataNamespace;
};

type AuthLocalNamespaceProviderProps = {
  children: ReactNode;
};

export function LocalDataNamespaceBoundary({
  children,
  namespace,
}: NamespaceBoundaryProps) {
  const [isReady, setIsReady] = useState(false);

  useLayoutEffect(() => {
    setCurrentLocalDataNamespace(namespace);
    setIsReady(true);

    return () => {
      resetCurrentLocalDataNamespace();
    };
  }, [namespace.databaseName, namespace.id, namespace.source]);

  return isReady ? <>{children}</> : null;
}

export function LegacyLocalNamespaceProvider({
  children,
}: AuthLocalNamespaceProviderProps) {
  const namespace = getLegacyLocalDataNamespace();

  return (
    <LocalDataNamespaceBoundary
      key={namespace.databaseName}
      namespace={namespace}
    >
      {children}
    </LocalDataNamespaceBoundary>
  );
}

export function AuthLocalNamespaceProvider({
  children,
}: AuthLocalNamespaceProviderProps) {
  const { identity } = useSessionAuth();

  if (!identity) {
    return null;
  }

  const namespace = createAuthLocalDataNamespace(
    identity.issuer + '|' + identity.userId,
  );

  return (
    <LocalDataNamespaceBoundary
      key={namespace.databaseName}
      namespace={namespace}
    >
      {children}
    </LocalDataNamespaceBoundary>
  );
}
