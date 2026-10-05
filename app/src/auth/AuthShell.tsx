import { ClerkProvider, Show, SignInButton, SignOutButton, UserButton } from '@clerk/react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../components';
import { inspectLegacyLocalData, type LegacyLocalDataInspection } from '../data/localDataNamespace';
import { AccountBoundaryProvider } from './AccountBoundaryProvider';
import { canUseAuth, readAuthConfig, type AuthRuntimeConfig } from './authConfig';
import {
  AuthLocalNamespaceProvider,
  LegacyLocalNamespaceProvider,
} from './AuthLocalNamespaceProvider';

type AuthBoundaryProps = {
  children: ReactNode;
  config?: AuthRuntimeConfig;
};

type AuthShellProps = {
  children: ReactNode;
};

function LegacyLocalDataNotice() {
  const [inspection, setInspection] = useState<LegacyLocalDataInspection | null>(null);

  useEffect(() => {
    let active = true;

    inspectLegacyLocalData().then((result) => {
      if (active) {
        setInspection(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!inspection?.hasLegacyLocalData) {
    return null;
  }

  return (
    <section className="auth-handoff-notice" aria-labelledby="auth-handoff-title">
      <div>
        <strong id="auth-handoff-title">Existing local setup found</strong>
        <span>It has not been deleted.</span>
        <span>You are now using a separate signed-in local profile.</span>
        <span>The existing setup remains available for a future consented migration.</span>
        <span>Backup and export remain user-controlled.</span>
        <span>No data has been uploaded or synced.</span>
      </div>
    </section>
  );
}

export function AuthBoundary({ children, config = readAuthConfig() }: AuthBoundaryProps) {
  if (config.mode === 'local-fixture' && config.status === 'local-fixture' && (import.meta.env.DEV || import.meta.env.MODE === 'test')) {
    return <LegacyLocalNamespaceProvider><p role="status">Local development fixture. Data stays on this device.</p>{children}</LegacyLocalNamespaceProvider>;
  }
  if (!canUseAuth(config)) {
    return <main className="auth-landing"><section className="auth-card" role="alert"><h1>Access is unavailable</h1><p>Required account access is not configured. Your local data has been preserved.</p></section></main>;
  }

  return (
    <ClerkProvider publishableKey={config.publishableKey}>
      <AuthShell>{children}</AuthShell>
    </ClerkProvider>
  );
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <>
      <Show when="signed-out">
        <main className="auth-landing" aria-labelledby="auth-landing-title">
          <section className="auth-card">
            <p className="eyebrow">Invite-only trial</p>
            <h1 id="auth-landing-title">Life Rhythm trial access</h1>
            <p>Sign in with your invited account.</p>
            <p>Login identifies you for trial access. It does not upload your Life Rhythm data.</p>
            <p>Your local data stays on this device unless a future sync feature clearly says otherwise.</p>
            <SignInButton mode="modal">
              <Button variant="primary">Sign in</Button>
            </SignInButton>
          </section>
        </main>
      </Show>

      <Show when="signed-in">
        <>
          <aside className="auth-account-bar" aria-label="Trial access status">
            <div>
              <strong>Signed in.</strong>
              <span>Local-first data remains on this device.</span>
              <span>This local profile is separate from other signed-in testers on this device.</span>
              <span>Signing out does not delete local data.</span>
              <span>Backup and export remain user-controlled.</span>
            </div>
            <div className="auth-account-bar__actions">
              <UserButton />
              <SignOutButton redirectUrl="/">
                <Button variant="secondary">Sign out</Button>
              </SignOutButton>
            </div>
          </aside>
          <AccountBoundaryProvider>
            <AuthLocalNamespaceProvider>
              <LegacyLocalDataNotice />
              {children}
            </AuthLocalNamespaceProvider>
          </AccountBoundaryProvider>
        </>
      </Show>
    </>
  );
}
