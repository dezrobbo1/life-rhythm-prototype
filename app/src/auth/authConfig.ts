export type AuthRuntimeConfig = {
  mode: 'required' | 'local-fixture';
  authRequested: boolean;
  publishableKey: string | null;
  status: 'enabled' | 'missing-key' | 'invalid-mode' | 'local-fixture';
};
type AuthEnv = {
  VITE_CLERK_PUBLISHABLE_KEY?: unknown;
  VITE_LIFE_RHYTHM_AUTH_ENABLED?: unknown;
  VITE_LIFE_RHYTHM_MODE?: unknown;
  DEV?: boolean;
  MODE?: string;
};
const envString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
export function readAuthConfig(env: AuthEnv = import.meta.env): AuthRuntimeConfig {
  const mode = envString(env.VITE_LIFE_RHYTHM_MODE) || 'required';
  const fixture = mode === 'local-fixture' && (env.DEV === true || env.MODE === 'test');
  if (fixture)
    return {
      mode: 'local-fixture',
      authRequested: false,
      publishableKey: null,
      status: 'local-fixture',
    };
  const authRequested = envString(env.VITE_LIFE_RHYTHM_AUTH_ENABLED) === 'true';
  const key = envString(env.VITE_CLERK_PUBLISHABLE_KEY);
  const validKey = /^pk_(test|live)_[A-Za-z0-9_-]+$/.test(key);
  return {
    mode: 'required',
    authRequested,
    publishableKey: authRequested && validKey ? key : null,
    status:
      mode !== 'required' ? 'invalid-mode' : authRequested && validKey ? 'enabled' : 'missing-key',
  };
}
export function canUseAuth(
  config: AuthRuntimeConfig,
): config is AuthRuntimeConfig & { publishableKey: string; status: 'enabled' } {
  return (
    config.mode === 'required' &&
    config.status === 'enabled' &&
    config.authRequested &&
    !!config.publishableKey
  );
}
