import { ClerkProvider, Show, SignInButton, SignOutButton, UserButton } from '@clerk/react';
import type { ReactNode } from 'react';
import { Button } from '../components';
import { canUseAuth, readAuthConfig, type AuthRuntimeConfig } from './authConfig';

type AuthBoundaryProps = {
  children: ReactNode;
  config?: AuthRuntimeConfig;
};

type AuthShellProps = {
  children: ReactNode;
};

export function AuthBoundary({ children, config = readAuthConfig() }: AuthBoundaryProps) {
  if (!canUseAuth(config)) {
    return <>{children}</>;
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
        <aside className="auth-account-bar" aria-label="Trial access status">
          <div>
            <strong>Signed in for trial access.</strong>
            <span>Local-first data remains on this device.</span>
            <span>Backup and export remain user-controlled.</span>
          </div>
          <div className="auth-account-bar__actions">
            <UserButton />
            <SignOutButton redirectUrl="/">
              <Button variant="secondary">Sign out</Button>
            </SignOutButton>
          </div>
        </aside>
        {children}
      </Show>
    </>
  );
}
