/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIFE_RHYTHM_MODE?: string;
  readonly VITE_LIFE_RHYTHM_BUILD_ID?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_LIFE_RHYTHM_AUTH_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
