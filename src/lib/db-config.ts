import { withBasePath } from '@/lib/base-path';

/** Manifest URL — the deploy workflow bakes the latest DB into the static build. */
export const DB_MANIFEST_URL = withBasePath('/db/manifest.json');

/** Fallback direct URL for uncompressed DB (used when manifest is unavailable). */
export const DB_FALLBACK_URL = withBasePath(
  '/db/source_com_repositorios.sqlite'
);
