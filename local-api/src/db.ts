import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type Row = Record<string, unknown>;

/**
 * Thin wrapper over a read-only better-sqlite3 connection to a SunCVE snapshot.
 *
 * The connection is opened read-only, so we never mutate the user's downloaded
 * database file. Some columns are newer than older snapshots (notably
 * `cves.exists_nuclei` / `cves.list_nuclei`, and on very old committed snapshots
 * `repositories.ecosystem` / `active_installs` / `downloads` / `package_url`).
 * `hasColumn` lets query builders degrade gracefully instead of throwing.
 */
export class Db {
  readonly db: Database.Database;
  readonly path: string;
  private columnCache = new Map<string, Set<string>>();

  constructor(path: string) {
    this.path = path;
    this.db = new Database(path, { readonly: true, fileMustExist: true });
  }

  all<T = Row>(sql: string, params: (string | number)[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  get<T = Row>(sql: string, params: (string | number)[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  columns(table: string): Set<string> {
    let set = this.columnCache.get(table);
    if (!set) {
      const rows = this.db
        .prepare(`PRAGMA table_info(${table})`)
        .all() as { name: string }[];
      set = new Set(rows.map((r) => r.name));
      this.columnCache.set(table, set);
    }
    return set;
  }

  hasColumn(table: string, col: string): boolean {
    return this.columns(table).has(col);
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Resolve the SQLite path from SUNCVE_DB, or fall back to the conventional
 * locations relative to the current working directory.
 */
export function resolveDbPath(): string {
  const envPath = process.env.SUNCVE_DB;
  const candidates = envPath
    ? [resolve(envPath)]
    : [
        resolve(process.cwd(), 'data/source.sqlite'),
        resolve(process.cwd(), 'local-api/data/source.sqlite')
      ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `SunCVE SQLite database not found.\n` +
      `Set SUNCVE_DB=/path/to/source.sqlite or run "npm run db:download".\n` +
      `Looked in: ${candidates.join(', ')}`
  );
}

export function openDb(): Db {
  return new Db(resolveDbPath());
}
