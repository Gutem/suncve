import { withBasePath } from '@/lib/base-path';

/**
 * If NEXT_PUBLIC_DB_RELEASE_URL is set (e.g. a GitHub Release download URL),
 * the frontend fetches manifest.json and the DB file directly from the release,
 * so the site always serves the latest DB without needing a redeploy.
 *
 * Fallback: static files baked into the build at /db/*.
 */
const DB_RELEASE_URL = process.env.NEXT_PUBLIC_DB_RELEASE_URL?.replace(
  /\/$/,
  ''
);

export const DB_MANIFEST_URL = DB_RELEASE_URL
  ? `${DB_RELEASE_URL}/manifest.json`
  : withBasePath('/db/manifest.json');

export const DB_FALLBACK_URL = withBasePath(
  '/db/source_com_repositorios.sqlite'
);

