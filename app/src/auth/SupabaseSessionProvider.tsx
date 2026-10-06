import { createClient, type Session } from '@supabase/supabase-js';
import { decodeJwt } from 'jose';
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';
type Identity = {
  issuer: string;
  userId: string;
  sessionId: string;
  bearer: string;
  expiresAt: number;
};
type AuthState = {
  identity: Identity | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
};
const AuthContext = createContext<AuthState | null>(null);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Client decoding binds requests/UI only; the API independently verifies every token and access row.
function identityFromSession(
  session: Session | null,
  issuer: string,
): Identity | null {
  try {
    if (!session || !uuid.test(session.user.id)) return null;
    const claims = decodeJwt(session.access_token);
    if (
      claims.sub !== session.user.id ||
      typeof claims.session_id !== 'string' ||
      !uuid.test(claims.session_id) ||
      typeof claims.exp !== 'number' ||
      claims.exp <= Date.now() / 1000
    )
      return null;
    return {
      issuer,
      userId: session.user.id,
      sessionId: claims.session_id,
      bearer: session.access_token,
      expiresAt: claims.exp * 1000,
    };
  } catch {
    return null;
  }
}
export function SupabaseSessionProvider({
  children,
  url,
  publishableKey,
}: {
  children: ReactNode;
  url: string;
  publishableKey: string;
}) {
  const [client] = useState(() =>
    createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }),
  );
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const accepting = useRef(true),
    active = useRef(true),
    epoch = useRef(0);
  const mutations = useRef<Promise<void>>(Promise.resolve());
  const localLogout = useRef(false);
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = mutations.current.then(operation);
    mutations.current = next.then(
      () => {},
      () => {},
    );
    return next;
  }
  const issuer = url + '/auth/v1';
  useEffect(() => {
    active.current = true;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!active.current) return;
      if (event === 'SIGNED_OUT') {
        accepting.current = false;
        if (!localLogout.current) epoch.current++;
      }
      const next = accepting.current
        ? identityFromSession(session, issuer)
        : null;
      setIdentity((previous) =>
        previous &&
        next &&
        previous.userId === next.userId &&
        previous.sessionId === next.sessionId &&
        previous.issuer === next.issuer &&
        previous.bearer === next.bearer &&
        previous.expiresAt === next.expiresAt
          ? previous
          : next,
      );
      setLoading(false);
    });
    return () => {
      active.current = false;
      epoch.current++;
      subscription.unsubscribe();
      client.auth.stopAutoRefresh();
    };
  }, [client, issuer]);
  useEffect(() => {
    if (!identity) return;
    const timer = setTimeout(
      () => {
        accepting.current = false;
        epoch.current++;
        setIdentity(null);
        client.auth.stopAutoRefresh();
      },
      Math.max(0, identity.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [identity, client]);
  const signIn = (email: string, password: string) => {
    const attempt = ++epoch.current;
    accepting.current = false;
    setIdentity(null);
    return enqueue(async () => {
      if (!active.current || attempt !== epoch.current) return false;
      accepting.current = true;
      try {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (!active.current || attempt !== epoch.current) return false;
        if (error) {
          accepting.current = false;
          setIdentity(null);
          return false;
        }
        client.auth.startAutoRefresh();
        return true;
      } catch {
        if (active.current && attempt === epoch.current) {
          accepting.current = false;
          setIdentity(null);
        }
        return false;
      }
    });
  };
  const signOut = () => {
    accepting.current = false;
    epoch.current++;
    setIdentity(null);
    setLoading(false);
    client.auth.stopAutoRefresh();
    // SDK logout removes its current session after HTTP settles. A subsequent
    // login must wait for that removal, even when the logout request fails.
    return enqueue(async () => {
      localLogout.current = true;
      try {
        await client.auth.signOut({ scope: 'local' });
      } catch {
        /* UI remains closed even if provider revocation fails. */
      } finally {
        localLogout.current = false;
      }
    });
  };
  const getToken = useCallback(
    async () => identity?.bearer ?? null,
    [identity],
  );
  return (
    <AuthContext.Provider
      value={{ identity, loading, signIn, signOut, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useSessionAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Missing authentication boundary');
  return value;
}
