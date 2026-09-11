/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CPHC_API_URL?: string;
  readonly VITE_CPHC_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
