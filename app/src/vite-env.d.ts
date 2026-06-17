/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_LIFE_RHYTHM_AUTH_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
