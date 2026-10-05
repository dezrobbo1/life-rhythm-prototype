import { useSessionAuth } from './SupabaseSessionProvider';
import { useEffect, useState, type ReactNode } from 'react';
import { boundaryResponseSchema } from '../account/accountBoundarySchema';
import { boundedJson } from '../account/boundedJson';
type GateProps = {
  children: ReactNode;
  accountId: string;
  sessionId: string;
  getToken: () => Promise<string | null>;
};
function BoundRequest({ children, getToken }: GateProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      if (active) setState('failed');
    }, 6000);
    setState('loading');
    void (async () => {
      try {
        const bearer = await getToken();
        if (!active || controller.signal.aborted) return;
        if (!bearer) throw new Error('unavailable');
        const response = await fetch(
          '/api/account/boundary?protocolVersion=1&schemaVersion=1',
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${bearer}` },
            credentials: 'omit',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        const body = boundaryResponseSchema.parse(await boundedJson(response));
        if (response.status !== 200 || body.kind !== 'ready')
          throw new Error('unavailable');
        if (active && !controller.signal.aborted) setState('ready');
      } catch {
        if (active) setState('failed');
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [getToken, retry]);
  if (state === 'loading')
    return (
      <main className="auth-landing" role="status">
        <section className="auth-card">
          <h1>Checking account access</h1>
          <p>Your local data stays on this device.</p>
        </section>
      </main>
    );
  if (state === 'failed')
    return (
      <main className="auth-landing">
        <section className="auth-card" role="alert">
          <h1>Account access is unavailable</h1>
          <p>
            Access could not be verified. Your local data has been preserved.
          </p>
          <button
            type="button"
            onClick={() => {
              setState('loading');
              setRetry((value) => value + 1);
            }}
          >
            Try again
          </button>
        </section>
      </main>
    );
  return (
    <>
      <p className="auth-handoff-notice" role="status">
        Device-only data. Account access is verified; personal data is not
        synced.
      </p>
      {children}
    </>
  );
}
/** Keyed by both account and session: old success cannot render during a new identity's first frame. */
export function AccountBoundaryGate(props: GateProps) {
  return (
    <BoundRequest
      key={JSON.stringify([props.accountId, props.sessionId])}
      {...props}
    />
  );
}
export function AccountBoundaryProvider({ children }: { children: ReactNode }) {
  const { loading, identity, getToken } = useSessionAuth();
  if (loading)
    return (
      <main className="auth-landing" role="status">
        Checking sign-in
      </main>
    );
  if (!identity) return null;
  return (
    <AccountBoundaryGate
      accountId={identity.issuer + '|' + identity.userId}
      sessionId={identity.sessionId}
      getToken={getToken}
    >
      {children}
    </AccountBoundaryGate>
  );
}
