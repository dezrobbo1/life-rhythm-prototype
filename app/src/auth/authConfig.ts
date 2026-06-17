export type AuthStatus = 'disabled' | 'missing-key' | 'enabled';

export type AuthRuntimeConfig = {
  authRequested: boolean;
  publishableKey: string | null;
  status: AuthStatus;
};

type AuthEnv = {
  VITE_CLERK_PUBLISHABLE_KEY?: unknown;
  VITE_LIFE_RHYTHM_AUTH_ENABLED?: unknown;
};

function envString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function readAuthConfig(env: AuthEnv = import.meta.env): AuthRuntimeConfig {
  const authEnabledValue = envString(env.VITE_LIFE_RHYTHM_AUTH_ENABLED);
  const authRequested = authEnabledValue === 'true';
  const publishableKey = envString(env.VITE_CLERK_PUBLISHABLE_KEY);

  if (!authRequested) {
    return {
      authRequested: false,
      publishableKey: null,
      status: 'disabled',
    };
  }

  if (!publishableKey) {
    return {
      authRequested: true,
      publishableKey: null,
      status: 'missing-key',
    };
  }

  return {
    authRequested: true,
    publishableKey,
    status: 'enabled',
  };
}

export function canUseAuth(
  config: AuthRuntimeConfig,
): config is AuthRuntimeConfig & { publishableKey: string; status: 'enabled' } {
  return config.status === 'enabled' && Boolean(config.publishableKey);
}
