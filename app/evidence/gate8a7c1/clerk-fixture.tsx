// Test-server alias only: never imported by the production entry/build.
import { useSyncExternalStore, type ReactNode } from 'react';
let auth = { isLoaded: true, isSignedIn: false, userId: 'user_A', sessionId: 'sess_A' };
const listeners = new Set<() => void>();
const getToken = async () => 'synthetic.session.token';
export function setFixtureAuth(update: Partial<typeof auth>) {
  auth = { ...auth, ...update };
  listeners.forEach((listener) => listener());
}
export function useAuth() {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => auth,
  );
  return { ...value, getToken };
}
export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function Show({ children, when }: { children: ReactNode; when: string }) {
  const state = useAuth();
  return state.isLoaded && (when === 'signed-in') === state.isSignedIn ? <>{children}</> : null;
}
export function SignInButton({ children }: { children: ReactNode }) {
  return <span onClick={() => setFixtureAuth({ isSignedIn: true })}>{children}</span>;
}
export function SignOutButton({ children }: { children: ReactNode }) {
  return <span onClick={() => setFixtureAuth({ isSignedIn: false })}>{children}</span>;
}
export function UserButton() {
  return <button type="button">Account</button>;
}
