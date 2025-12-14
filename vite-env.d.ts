/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRADIO_ENDPOINT: string;
  readonly VITE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
