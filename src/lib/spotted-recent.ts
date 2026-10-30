import type { SpottedScanLogRow } from './database.types';

export type RecentSpottedScan = Pick<
  SpottedScanLogRow,
  | 'id'
  | 'scan_at'
  | 'total_words'
  | 'mastered_count'
  | 'learning_count'
  | 'unseen_count'
  | 'term_ids'
>;

export function recognizedTermCount(scan: RecentSpottedScan): number {
  return new Set(scan.term_ids ?? []).size;
}

export function describeRecentSpottedScan(scan: RecentSpottedScan): string {
  return [
    `${recognizedTermCount(scan)} recognized`,
    `${scan.mastered_count} mastered`,
    `${scan.unseen_count} new`,
  ].join(' · ');
}

const claimedScanLogKeys = new Set<string>();

export function claimSpottedScanLog(userId: string, text: string): boolean {
  const normalized = text.trim();
  if (!userId || normalized.length === 0) return false;
  const key = `${userId}:${normalized}`;
  if (claimedScanLogKeys.has(key)) return false;
  claimedScanLogKeys.add(key);
  return true;
}

export function _resetClaimedSpottedScanLogsForTest() {
  claimedScanLogKeys.clear();
}
