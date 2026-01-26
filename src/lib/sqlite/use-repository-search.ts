'use client';

import { useState, useCallback, useRef } from 'react';
import { useSQLite } from './sqlite-context';
import type {
  RepositorySearchFilters,
  RepositorySortConfig,
  RepositorySearchResult,
  RepositorySearchResultsPage,
  CVESearchResult
} from '@/features/search/types';
import { getSeverityFromScore } from '@/features/search/types';

const DEFAULT_PAGE_SIZE = 50;

// Cache for expensive queries
interface QueryCache {
  filterOptions: {
    languages: { languageMain: string; count: number }[];
  } | null;
  stats: {
    totalRepos: number;
    withCVEs: number;
    withCommitFix: number;
    topLanguages: { language: string; count: number }[];
  } | null;
}

export function useRepositorySearch() {
  const { executeQuery, isReady } = useSQLite();
  const [isSearching, setIsSearching] = useState(false);
  const cacheRef = useRef<QueryCache>({ filterOptions: null, stats: null });

  const buildWhereClause = useCallback(
    (
      filters: RepositorySearchFilters
    ): { where: string; params: (string | number)[] } => {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      // Text search - search in fullpath, name
      if (filters.query.trim()) {
        const searchTerm = `%${filters.query.trim()}%`;
        conditions.push(`(
          r.fullpath LIKE ? ESCAPE '\\' OR 
          r.name LIKE ? ESCAPE '\\'
        )`);
        params.push(searchTerm, searchTerm);
      }

      // Language filter
      if (filters.languages.length > 0) {
        const langPlaceholders = filters.languages.map(() => '?').join(',');
        conditions.push(`r.languageMain IN (${langPlaceholders})`);
        params.push(...filters.languages);
      }

      // Stars range
      if (filters.starsMin !== null) {
        conditions.push('r.stars >= ?');
        params.push(filters.starsMin);
      }
      if (filters.starsMax !== null) {
        conditions.push('r.stars <= ?');
        params.push(filters.starsMax);
      }

      // Size range
      if (filters.sizeMin !== null) {
        conditions.push('r.size >= ?');
        params.push(filters.sizeMin);
      }
      if (filters.sizeMax !== null) {
        conditions.push('r.size <= ?');
        params.push(filters.sizeMax);
      }

      // Has CVEs - use subquery
      if (filters.hasCVEs !== null) {
        if (filters.hasCVEs) {
          conditions.push(
            `r.fullpath IN (SELECT DISTINCT repository_fullpath FROM cve_repositories)`
          );
        } else {
          conditions.push(
            `r.fullpath NOT IN (SELECT DISTINCT repository_fullpath FROM cve_repositories)`
          );
        }
      }

      // Has commit fix
      if (filters.hasCommitFix !== null) {
        if (filters.hasCommitFix) {
          conditions.push('r.commits_fix_count > 0');
        } else {
          conditions.push(
            '(r.commits_fix_count IS NULL OR r.commits_fix_count = 0)'
          );
        }
      }

      const where =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      return { where, params };
    },
    []
  );

  const search = useCallback(
    async (
      filters: RepositorySearchFilters,
      sort: RepositorySortConfig,
      page: number = 1,
      pageSize: number = DEFAULT_PAGE_SIZE
    ): Promise<RepositorySearchResultsPage> => {
      if (!isReady) {
        return { results: [], total: 0, page, pageSize, totalPages: 0 };
      }

      setIsSearching(true);

      try {
        const { where, params } = buildWhereClause(filters);
        const offset = (page - 1) * pageSize;

        // Build ORDER BY clause
        let orderBy = 'r.stars DESC NULLS LAST';
        switch (sort.field) {
          case 'fullpath':
            orderBy = `r.fullpath ${sort.order.toUpperCase()}`;
            break;
          case 'name':
            orderBy = `r.name ${sort.order.toUpperCase()} NULLS LAST`;
            break;
          case 'stars':
            orderBy = `r.stars ${sort.order.toUpperCase()} NULLS LAST`;
            break;
          case 'size':
            orderBy = `r.size ${sort.order.toUpperCase()} NULLS LAST`;
            break;
          case 'cve_count':
            orderBy = `cve_count ${sort.order.toUpperCase()}`;
            break;
          case 'commits_fix_count':
            orderBy = `r.commits_fix_count ${sort.order.toUpperCase()} NULLS LAST`;
            break;
          case 'created_repository':
            orderBy = `r.created_repository ${sort.order.toUpperCase()} NULLS LAST`;
            break;
          case 'updated_repository':
            orderBy = `r.updated_repository ${sort.order.toUpperCase()} NULLS LAST`;
            break;
        }

        // Query with CVE count
        const searchQuery = `
          WITH 
          -- Count CVEs per repository
          cve_counts AS (
            SELECT repository_fullpath, COUNT(*) as cve_count 
            FROM cve_repositories 
            GROUP BY repository_fullpath
          ),
          -- Filter repositories first
          filtered_repos AS (
            SELECT r.fullpath
            FROM repositories r
            ${where}
          ),
          -- Count total
          total_count AS (
            SELECT COUNT(*) as total FROM filtered_repos
          )
          SELECT 
            r.fullpath,
            r.name,
            r.stars,
            r.size,
            r.languageMain,
            COALESCE(cc.cve_count, 0) as cve_count,
            r.commits_fix_count,
            r.created_repository,
            r.updated_repository,
            tc.total
          FROM repositories r
          INNER JOIN filtered_repos fr ON fr.fullpath = r.fullpath
          CROSS JOIN total_count tc
          LEFT JOIN cve_counts cc ON cc.repository_fullpath = r.fullpath
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?
        `;

        const searchParams = [...params, pageSize, offset];

        interface RawResult extends RepositorySearchResult {
          total: number;
        }

        const rawResults = executeQuery<RawResult>(searchQuery, searchParams);

        // Get total from first row (or 0 if no results)
        const total = rawResults.length > 0 ? (rawResults[0].total ?? 0) : 0;

        const results: RepositorySearchResult[] = rawResults.map((row) => ({
          fullpath: row.fullpath,
          name: row.name,
          stars: row.stars,
          size: row.size,
          languageMain: row.languageMain,
          cve_count: row.cve_count,
          commits_fix_count: row.commits_fix_count,
          created_repository: row.created_repository,
          updated_repository: row.updated_repository
        }));

        return {
          results,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        };
      } finally {
        setIsSearching(false);
      }
    },
    [isReady, executeQuery, buildWhereClause]
  );

  // Get filter options (cached)
  const getFilterOptions = useCallback(() => {
    if (!isReady) {
      return { languages: [] };
    }

    // Return cached if available
    if (cacheRef.current.filterOptions) {
      return cacheRef.current.filterOptions;
    }

    const languages = executeQuery<{ languageMain: string; count: number }>(`
      SELECT languageMain, COUNT(*) as count 
      FROM repositories 
      WHERE languageMain IS NOT NULL AND languageMain != ''
      GROUP BY languageMain 
      ORDER BY count DESC
      LIMIT 50
    `);

    // Cache the results
    cacheRef.current.filterOptions = { languages };
    return cacheRef.current.filterOptions;
  }, [isReady, executeQuery]);

  // Get repository details with related CVEs
  const getRepositoryDetails = useCallback(
    (fullpath: string) => {
      if (!isReady) return null;

      // Get repository info
      const result = executeQuery<Record<string, unknown>>(
        `SELECT * FROM repositories WHERE fullpath = ?`,
        [fullpath]
      );

      if (result.length === 0) return null;
      const repo = result[0];

      // Get related CVEs with details
      const cves = executeQuery<{
        cve_id: string;
        title: string | null;
        description: string | null;
        date_published: string | null;
        date_updated: string | null;
        exists_exploit: number;
        exists_commit: number;
        max_score: number | null;
        relation_type: string | null;
      }>(
        `
        SELECT 
          c.cve_id,
          c.title,
          c.description,
          c.date_published,
          c.date_updated,
          c.exists_exploit,
          c.exists_commit,
          (SELECT MAX(score) FROM cve_scores WHERE cve_id = c.cve_id) as max_score,
          cr.relation_type
        FROM cve_repositories cr
        JOIN cves c ON cr.cve_id = c.cve_id
        WHERE cr.repository_fullpath = ?
        ORDER BY c.date_published DESC
        LIMIT 100
      `,
        [fullpath]
      );

      // Map CVEs to CVESearchResult format
      const cvesWithSeverity: CVESearchResult[] = cves.map((cve) => ({
        cve_id: cve.cve_id,
        title: cve.title,
        description: cve.description,
        date_published: cve.date_published,
        date_updated: cve.date_updated,
        exists_exploit: Boolean(cve.exists_exploit),
        exists_commit: Boolean(cve.exists_commit),
        max_score: cve.max_score,
        severity: getSeverityFromScore(cve.max_score ?? 0),
        cwe_list: null,
        vendor_list: null,
        product_list: null,
        repo_count: 0,
        repo_fullpath: fullpath,
        repo_stars: repo.stars as number | null,
        repo_language: repo.languageMain as string | null
      }));

      return {
        ...repo,
        cves: cvesWithSeverity,
        cve_count: cves.length
      };
    },
    [isReady, executeQuery]
  );

  // Get statistics (cached)
  const getStats = useCallback(() => {
    if (!isReady) {
      return {
        totalRepos: 0,
        withCVEs: 0,
        withCommitFix: 0,
        topLanguages: []
      };
    }

    // Return cached if available
    if (cacheRef.current.stats) {
      return cacheRef.current.stats;
    }

    // Get basic stats
    const stats = executeQuery<{
      totalRepos: number;
      withCVEs: number;
      withCommitFix: number;
    }>(`
      SELECT 
        (SELECT COUNT(*) FROM repositories) as totalRepos,
        (SELECT COUNT(DISTINCT repository_fullpath) FROM cve_repositories) as withCVEs,
        (SELECT COUNT(*) FROM repositories WHERE commits_fix_count > 0) as withCommitFix
    `)[0];

    // Get top languages
    const topLanguages = executeQuery<{ language: string; count: number }>(`
      SELECT languageMain as language, COUNT(*) as count 
      FROM repositories 
      WHERE languageMain IS NOT NULL AND languageMain != ''
      GROUP BY languageMain 
      ORDER BY count DESC
      LIMIT 5
    `);

    const result = {
      totalRepos: stats?.totalRepos ?? 0,
      withCVEs: stats?.withCVEs ?? 0,
      withCommitFix: stats?.withCommitFix ?? 0,
      topLanguages
    };

    // Cache the results
    cacheRef.current.stats = result;
    return result;
  }, [isReady, executeQuery]);

  // Get filtered statistics
  const getFilteredStats = useCallback(
    (filters: RepositorySearchFilters) => {
      if (!isReady) {
        return {
          totalRepos: 0,
          withCVEs: 0,
          withCommitFix: 0,
          topLanguages: []
        };
      }

      const { where, params } = buildWhereClause(filters);

      // Query stats for filtered repositories
      const stats = executeQuery<{
        totalRepos: number;
        withCVEs: number;
        withCommitFix: number;
      }>(
        `
        WITH filtered_repos AS (
          SELECT r.fullpath, r.commits_fix_count
          FROM repositories r
          ${where}
        )
        SELECT 
          COUNT(*) as totalRepos,
          (SELECT COUNT(DISTINCT fr.fullpath) 
           FROM filtered_repos fr
           JOIN cve_repositories cr ON cr.repository_fullpath = fr.fullpath) as withCVEs,
          SUM(CASE WHEN commits_fix_count > 0 THEN 1 ELSE 0 END) as withCommitFix
        FROM filtered_repos
      `,
        params
      )[0];

      return {
        totalRepos: stats?.totalRepos ?? 0,
        withCVEs: stats?.withCVEs ?? 0,
        withCommitFix: stats?.withCommitFix ?? 0,
        topLanguages: [] // Not computed for filtered stats for performance
      };
    },
    [isReady, executeQuery, buildWhereClause]
  );

  return {
    search,
    getFilterOptions,
    getRepositoryDetails,
    getStats,
    getFilteredStats,
    isSearching,
    isReady
  };
}
