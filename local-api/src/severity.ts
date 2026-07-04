// Ported verbatim from src/features/search/types.ts so severity derivation
// matches the web UI exactly.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'none';

export function getSeverityFromScore(score: number): Severity {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}
