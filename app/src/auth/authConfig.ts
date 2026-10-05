export type AuthRuntimeConfig = {
  mode: 'required' | 'local-fixture';
  authRequested: boolean;
  publishableKey: string | null;
  supabaseUrl: string | null;
  status: 'enabled' | 'missing-key' | 'invalid-mode' | 'local-fixture';
};
type AuthEnv = {
  VITE_SUPABASE_PUBLISHABLE_KEY?: unknown;
  VITE_SUPABASE_URL?: unknown;
  VITE_LIFE_RHYTHM_AUTH_ENABLED?: unknown;
  VITE_LIFE_RHYTHM_MODE?: unknown;
  DEV?: boolean;
  MODE?: string;
};
const envString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';
export function readAuthConfig(
  env: AuthEnv = import.meta.env,
): AuthRuntimeConfig {
  const mode = envString(env.VITE_LIFE_RHYTHM_MODE) || 'required';
  const fixture =
    mode === 'local-fixture' && (env.DEV === true || env.MODE === 'test');
  if (fixture)
    return {
      mode: 'local-fixture',
      authRequested: false,
      publishableKey: null,
      supabaseUrl: null,
      status: 'local-fixture',
    };
  const authRequested = envString(env.VITE_LIFE_RHYTHM_AUTH_ENABLED) === 'true';
  const key = envString(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const url = envString(env.VITE_SUPABASE_URL);
  const validKey =
    /^sb_publishable_[A-Za-z0-9_-]{1,256}$/.test(key) &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url);
  return {
    mode: 'required',
    authRequested,
    supabaseUrl: authRequested && validKey ? url : null,
    publishableKey: authRequested && validKey ? key : null,
    status:
      mode !== 'required'
        ? 'invalid-mode'
        : authRequested && validKey
          ? 'enabled'
          : 'missing-key',
  };
}
export function canUseAuth(
  config: AuthRuntimeConfig,
): config is AuthRuntimeConfig & {
  publishableKey: string;
  supabaseUrl: string;
  status: 'enabled';
} {
  return (
    config.mode === 'required' &&
    config.status === 'enabled' &&
    config.authRequested &&
    !!config.publishableKey &&
    !!config.supabaseUrl
  );
}
