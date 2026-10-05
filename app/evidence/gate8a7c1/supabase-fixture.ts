// SDK alias for the synthetic replay server only. Production uses the actual Supabase SDK.
let auth = {
  isLoaded: true,
  isSignedIn: false,
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sessionId: '11111111-1111-4111-8111-111111111111',
};
const listeners = new Set<(event: string, session: unknown) => void>();
function session() {
  return auth.isSignedIn
    ? {
        user: { id: auth.userId },
        access_token:
          'e30.' +
          btoa(
            JSON.stringify({
              sub: auth.userId,
              session_id: auth.sessionId,
              exp: Math.floor(Date.now() / 1000) + 60,
            }),
          ) +
          '.synthetic',
      }
    : null;
}
export function setFixtureAuth(update: Partial<typeof auth>) {
  auth = { ...auth, ...update };
  listeners.forEach((cb) =>
    cb(auth.isSignedIn ? 'SIGNED_IN' : 'SIGNED_OUT', session()),
  );
}
export function createClient() {
  return {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        listeners.add(cb);
        queueMicrotask(() => cb('INITIAL_SESSION', session()));
        return {
          data: { subscription: { unsubscribe: () => listeners.delete(cb) } },
        };
      },
      signInWithPassword: async () => {
        setFixtureAuth({ isSignedIn: true });
        return { error: null };
      },
      signOut: async () => {
        setFixtureAuth({ isSignedIn: false });
        return { error: null };
      },
      stopAutoRefresh: () => {},
      startAutoRefresh: () => {},
    },
  };
}
