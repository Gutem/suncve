'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode
} from 'react';
import type { DatabaseContext, LoadOptions } from './sqlite-loader';

// Define minimal Database interface
interface SqlJsDatabase {
  exec(
    sql: string,
    params?: unknown[]
  ): { columns: string[]; values: unknown[][] }[];
  close(): void;
}

interface SQLiteContextType {
  db: SqlJsDatabase | null;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  progress: number;
  location: 'opfs' | 'memory' | null;
  version: string | null;
  loadDatabase: (url: string, options?: LoadOptions) => Promise<void>;
  loadDatabaseWithManifest: (
    manifestUrl: string,
    options?: LoadOptions
  ) => Promise<void>;
  executeQuery: <T = Record<string, unknown>>(
    sql: string,
    params?: (string | number | null)[]
  ) => T[];
  clearCache: (fileName?: string) => Promise<void>;
}

const SQLiteContext = createContext<SQLiteContextType | null>(null);

// Global ref to persist database across React Strict Mode remounts
// This prevents the database from being closed and reopened unnecessarily
let globalDbInstance: SqlJsDatabase | null = null;
let globalDbVersion: string | null = null;
let globalDbLocation: 'opfs' | 'memory' | null = null;

export function SQLiteProvider({ children }: { children: ReactNode }) {
  // Initialize state from global instance if available
  const [db, setDb] = useState<SqlJsDatabase | null>(() => globalDbInstance);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(() => globalDbInstance !== null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(() => (globalDbInstance ? 100 : 0));
  const [location, setLocation] = useState<'opfs' | 'memory' | null>(
    () => globalDbLocation
  );
  const [version, setVersion] = useState<string | null>(() => globalDbVersion);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Load database with manifest (recommended for large DBs)
  const loadDatabaseWithManifest = useCallback(
    async (manifestUrl: string, options: LoadOptions = {}) => {
      // Skip if already have a database loaded
      if (globalDbInstance) {
        if (isMountedRef.current) {
          setDb(globalDbInstance);
          setLocation(globalDbLocation);
          setVersion(globalDbVersion);
          setIsReady(true);
          setProgress(100);
        }
        return;
      }

      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
        setProgress(0);
      }

      try {
        // Dynamic import to avoid bundler issues
        const { loadDatabase } = await import('./sqlite-loader');

        const ctx: DatabaseContext = await loadDatabase(manifestUrl, {
          ...options,
          onProgress: (p) => {
            if (isMountedRef.current) {
              setProgress(p);
            }
            options.onProgress?.(p);
          }
        });

        // Store in global instance
        globalDbInstance = ctx.db;
        globalDbLocation = ctx.location;
        globalDbVersion = ctx.version;

        if (isMountedRef.current) {
          setDb(ctx.db);
          setLocation(ctx.location);
          setVersion(ctx.version);
          setIsReady(true);
          setProgress(100);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load database';
        if (isMountedRef.current) {
          setError(message);
        }
        console.error('SQLite load error:', err);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  // Load database directly from URL (simpler, for smaller DBs)
  const loadDatabase = useCallback(
    async (url: string, options: LoadOptions = {}) => {
      // Skip if already have a database loaded
      if (globalDbInstance) {
        if (isMountedRef.current) {
          setDb(globalDbInstance);
          setLocation(globalDbLocation);
          setVersion(globalDbVersion);
          setIsReady(true);
          setProgress(100);
        }
        return;
      }

      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
        setProgress(0);
      }

      try {
        // Dynamic import to avoid bundler issues
        const { loadDatabaseFromUrl } = await import('./sqlite-loader');

        const ctx: DatabaseContext = await loadDatabaseFromUrl(url, {
          ...options,
          onProgress: (p) => {
            if (isMountedRef.current) {
              setProgress(p);
            }
            options.onProgress?.(p);
          }
        });

        // Store in global instance
        globalDbInstance = ctx.db;
        globalDbLocation = ctx.location;
        globalDbVersion = ctx.version;

        if (isMountedRef.current) {
          setDb(ctx.db);
          setLocation(ctx.location);
          setVersion(ctx.version);
          setIsReady(true);
          setProgress(100);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load database';
        if (isMountedRef.current) {
          setError(message);
        }
        console.error('SQLite load error:', err);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  // Clear cache
  const clearCache = useCallback(async (fileName?: string) => {
    try {
      // Close current database
      if (globalDbInstance) {
        try {
          globalDbInstance.close();
        } catch {
          // Ignore close errors
        }
        globalDbInstance = null;
        globalDbLocation = null;
        globalDbVersion = null;
      }

      const { clearStoredDatabase } = await import('./sqlite-loader');
      await clearStoredDatabase(fileName);

      if (isMountedRef.current) {
        setDb(null);
        setIsReady(false);
        setLocation(null);
        setVersion(null);
        setProgress(0);
      }
    } catch (err) {
      console.error('Error clearing cache:', err);
    }
  }, []);

  const executeQuery = useCallback(
    <T = Record<string, unknown>,>(
      sql: string,
      params: (string | number | null)[] = []
    ): T[] => {
      if (!db) {
        console.warn('Database not ready');
        return [];
      }

      try {
        const result = db.exec(sql, params);
        if (result.length === 0) return [];

        const { columns, values } = result[0];
        return (values as (string | number | null | Uint8Array)[][]).map(
          (row) => {
            const obj: Record<string, unknown> = {};
            columns.forEach((col: string, i: number) => {
              obj[col] = row[i];
            });
            return obj as T;
          }
        );
      } catch (err) {
        console.error('Query error:', err, sql);
        return [];
      }
    },
    [db]
  );

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Don't close the database on unmount - it's stored globally
      // and will be reused if the component remounts (React Strict Mode)
    };
  }, []);

  return (
    <SQLiteContext.Provider
      value={{
        db,
        isLoading,
        isReady,
        error,
        progress,
        location,
        version,
        loadDatabase,
        loadDatabaseWithManifest,
        executeQuery,
        clearCache
      }}
    >
      {children}
    </SQLiteContext.Provider>
  );
}

export function useSQLite() {
  const context = useContext(SQLiteContext);
  if (!context) {
    throw new Error('useSQLite must be used within SQLiteProvider');
  }
  return context;
}
