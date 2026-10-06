import {
  SupabaseSessionProvider,
  useSessionAuth,
} from './SupabaseSessionProvider';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../components';
import {
  inspectLegacyLocalData,
  type LegacyLocalDataInspection,
} from '../data/localDataNamespace';
import { AccountBoundaryProvider } from './AccountBoundaryProvider';
import {
  canUseAuth,
  readAuthConfig,
  type AuthRuntimeConfig,
} from './authConfig';
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
  const [inspection, setInspection] =
    useState<LegacyLocalDataInspection | null>(null);

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
    <section
      className="auth-handoff-notice"
      aria-labelledby="auth-handoff-title"
    >
      <div>
        <strong id="auth-handoff-title">Existing local setup found</strong>
        <span>It has not been deleted.</span>
        <span>You are now using a separate signed-in local profile.</span>
        <span>
          The existing setup remains available for a future consented migration.
        </span>
        <span>Backup and export remain user-controlled.</span>
        <span>No data has been uploaded or synced.</span>
      </div>
    </section>
  );
}

export function AuthBoundary({
  children,
  config = readAuthConfig(),
}: AuthBoundaryProps) {
  if (
    config.mode === 'local-fixture' &&
    config.status === 'local-fixture' &&
    (import.meta.env.DEV || import.meta.env.MODE === 'test')
  ) {
    return (
      <LegacyLocalNamespaceProvider>
        <p role="status">
          Local development fixture. Data stays on this device.
        </p>
        {children}
      </LegacyLocalNamespaceProvider>
    );
  }
  if (!canUseAuth(config)) {
    return (
      <main className="auth-landing">
        <section className="auth-card" role="alert">
          <h1>Access is unavailable</h1>
          <p>
            Required account access is not configured. Your local data has been
            preserved.
          </p>
        </section>
      </main>
    );
  }

  return (
    <SupabaseSessionProvider
      key={config.supabaseUrl}
      url={config.supabaseUrl}
      publishableKey={config.publishableKey}
    >
      <AuthShell>{children}</AuthShell>
    </SupabaseSessionProvider>
  );
}

function SignInForm() {
  const { signIn } = useSessionAuth();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <main className="auth-landing">
      <section className="auth-card">
        <p className="eyebrow">Restricted owner trial</p>
        <h1>Sign in</h1>
        <p>
          Use the account set up for you. Login does not upload your Life Rhythm
          data.
        </p>
        <p>Sign-in stays in this tab. Reloading requires sign-in again.</p>
        <form
          className="auth-signin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setFailed(false);
            const secret = password;
            setPassword('');
            try {
              setFailed(!(await signIn(email, secret)));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="auth-signin-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="auth-signin-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          {failed && (
            <p role="alert">
              Sign-in could not be completed. Check your account details or
              contact the operator.
            </p>
          )}
        </form>
        <p>
          Password recovery is not configured in this app. Contact the operator;
          creating another account will not recover a local profile.
        </p>
      </section>
    </main>
  );
}
export function AuthShell({ children }: AuthShellProps) {
  const { identity, loading, signOut } = useSessionAuth();
  if (loading)
    return (
      <main className="auth-landing" role="status">
        Checking sign-in
      </main>
    );
  if (!identity) return <SignInForm />;
  return (
    <>
      <aside className="auth-account-bar" aria-label="Trial access status">
        <div>
          <strong>Signed in.</strong>
          <span>Local-first data remains on this device.</span>
          <span>
            This local profile is separate from other accounts on this device.
          </span>
          <span>Signing out does not delete local data.</span>
          <span>Backup and export remain user-controlled.</span>
        </div>
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </aside>
      <AccountBoundaryProvider>
        <AuthLocalNamespaceProvider>
          <LegacyLocalDataNotice />
          {children}
        </AuthLocalNamespaceProvider>
      </AccountBoundaryProvider>
    </>
  );
}
