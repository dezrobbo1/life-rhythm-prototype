// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthBoundary } from './AuthShell';
import { readAuthConfig, type AuthRuntimeConfig } from './authConfig';

const clerkState = vi.hoisted(() => ({
  providerProps: vi.fn(),
  signedIn: false,
}));

vi.mock('@clerk/react', () => ({
  ClerkProvider: ({ children, publishableKey }: { children: ReactNode; publishableKey: string }) => {
    clerkState.providerProps({ publishableKey });
    return <div data-testid="clerk-provider">{children}</div>;
  },
  Show: ({ children, when }: { children: ReactNode; when: 'signed-in' | 'signed-out' }) => {
    const visibleState = clerkState.signedIn ? 'signed-in' : 'signed-out';
    return when === visibleState ? <>{children}</> : null;
  },
  SignInButton: ({ children, mode }: { children: ReactNode; mode?: string }) => (
    <span data-testid="clerk-sign-in" data-mode={mode}>
      {children}
    </span>
  ),
  SignOutButton: ({ children, redirectUrl }: { children: ReactNode; redirectUrl?: string }) => (
    <span data-testid="clerk-sign-out" data-redirect-url={redirectUrl}>
      {children}
    </span>
  ),
  UserButton: () => (
    <button aria-label="Account" type="button">
      Account
    </button>
  ),
}));

const disabledConfig: AuthRuntimeConfig = {
  authRequested: false,
  publishableKey: null,
  status: 'disabled',
};

const missingKeyConfig: AuthRuntimeConfig = {
  authRequested: true,
  publishableKey: null,
  status: 'missing-key',
};

const enabledConfig: AuthRuntimeConfig = {
  authRequested: true,
  publishableKey: 'pk_test_life_rhythm',
  status: 'enabled',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  clerkState.providerProps.mockClear();
});

beforeEach(() => {
  clerkState.signedIn = false;
});

describe('auth config', () => {
  it('keeps auth disabled by default', () => {
    expect(readAuthConfig({})).toEqual(disabledConfig);
  });

  it('requires both the auth flag and a publishable key before enabling Clerk', () => {
    expect(readAuthConfig({ VITE_LIFE_RHYTHM_AUTH_ENABLED: 'true' })).toEqual(missingKeyConfig);
    expect(readAuthConfig({ VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_without_flag' })).toEqual(disabledConfig);
    expect(readAuthConfig({
      VITE_CLERK_PUBLISHABLE_KEY: ' pk_test_life_rhythm ',
      VITE_LIFE_RHYTHM_AUTH_ENABLED: 'true',
    })).toEqual(enabledConfig);
  });
});

describe('AuthBoundary', () => {
  it('renders current local-first app behavior when auth is disabled', () => {
    render(
      <AuthBoundary config={disabledConfig}>
        <main>Current local-first app</main>
      </AuthBoundary>,
    );

    expect(screen.getByText('Current local-first app')).toBeTruthy();
    expect(screen.queryByTestId('clerk-provider')).toBeNull();
  });

  it('falls back safely when auth is requested but the Clerk key is missing', () => {
    render(
      <AuthBoundary config={missingKeyConfig}>
        <main>Local development app</main>
      </AuthBoundary>,
    );

    expect(screen.getByText('Local development app')).toBeTruthy();
    expect(screen.queryByText('Life Rhythm trial access')).toBeNull();
    expect(screen.queryByTestId('clerk-provider')).toBeNull();
  });

  it('shows the invite-only trial landing for signed-out users', () => {
    render(
      <AuthBoundary config={enabledConfig}>
        <main>Private app shell</main>
      </AuthBoundary>,
    );

    expect(clerkState.providerProps).toHaveBeenCalledWith({ publishableKey: 'pk_test_life_rhythm' });
    expect(screen.getByRole('heading', { name: 'Life Rhythm trial access' })).toBeTruthy();
    expect(screen.getByText('Sign in with your invited account.')).toBeTruthy();
    expect(screen.getByText('Login identifies you for trial access. It does not upload your Life Rhythm data.')).toBeTruthy();
    expect(screen.getByText('Your local data stays on this device unless a future sync feature clearly says otherwise.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByText('Private app shell')).toBeNull();
  });

  it('does not render a public sign-up button in the app UI', () => {
    render(
      <AuthBoundary config={enabledConfig}>
        <main>Private app shell</main>
      </AuthBoundary>,
    );

    expect(screen.queryByRole('button', { name: /sign up/i })).toBeNull();
    expect(screen.queryByText(/sign up/i)).toBeNull();
  });

  it('renders the app shell and sign-out affordance for signed-in users', () => {
    clerkState.signedIn = true;

    render(
      <AuthBoundary config={enabledConfig}>
        <main className="app-shell">Private app shell</main>
      </AuthBoundary>,
    );

    expect(screen.getByText('Signed in for trial access.')).toBeTruthy();
    expect(screen.getByText('Local-first data remains on this device.')).toBeTruthy();
    expect(screen.getByText('Backup and export remain user-controlled.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByText('Private app shell')).toBeTruthy();
  });

  it('does not call browser data upload or local storage APIs from the auth shell', () => {
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const fetchSpy = vi.fn();
    const localStorage = {
      getItem: vi.fn(() => {
        throw new Error('localStorage must not be read by auth shell');
      }),
      setItem: vi.fn(() => {
        throw new Error('localStorage must not be written by auth shell');
      }),
    };

    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchSpy,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });

    try {
      render(
        <AuthBoundary config={enabledConfig}>
          <main>Private app shell</main>
        </AuthBoundary>,
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    } finally {
      if (originalFetch) {
        Object.defineProperty(globalThis, 'fetch', originalFetch);
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }

      if (originalLocalStorage) {
        Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
      } else {
        Reflect.deleteProperty(globalThis, 'localStorage');
      }
    }
  });
});
