/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_ENABLE_DEMO_HUB: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
