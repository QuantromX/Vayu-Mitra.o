import type { AdviceResponse } from '../../types/index.ts';

const PROGRESS_STORAGE_PREFIX = 'vayumitra_plan_done_v1:';

export interface PlanProgress {
  completed: number;
  total: number;
  pct: number;
}

/**
 * Generates a stable action identifier for a section + index within today's plan.
 */
export function buildActionId(
  section: 'outdoor' | 'indoor' | 'routine',
  index: number
): string {
  return `${section}:${index}`;
}

/**
 * Collects all actionable row IDs from an AdviceResponse for plan progress tracking.
 */
export function collectPlanActionIds(advice: AdviceResponse | null): string[] {
  if (!advice) return [];
  const ids: string[] = [];
  advice.outdoor.forEach((_, idx) => ids.push(buildActionId('outdoor', idx)));
  advice.indoor.forEach((_, idx) => ids.push(buildActionId('indoor', idx)));
  advice.routine.forEach((_, idx) => ids.push(buildActionId('routine', idx)));
  return ids;
}

/**
 * Builds a daily IST storage key scoped to the active city so ticks reset naturally each day.
 */
export function buildPlanStorageKey(cityName: string, now = new Date()): string {
  const istDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const slug = cityName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return `${PROGRESS_STORAGE_PREFIX}${istDate}:${slug || 'city'}`;
}

/**
 * Loads completed action IDs from localStorage safely inside try/catch.
 */
export function loadCompletedActions(storageKey: string): string[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Persists completed action IDs to localStorage safely inside try/catch.
 */
export function saveCompletedActions(storageKey: string, ids: string[]): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(storageKey, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure toggle helper returning updated completed action IDs.
 */
export function toggleActionDone(currentIds: string[], actionId: string): string[] {
  if (currentIds.includes(actionId)) {
    return currentIds.filter((id) => id !== actionId);
  }
  return [...currentIds, actionId];
}

/**
 * Computes completion counts and integer percentage (0-100) for Today's plan ring.
 */
export function computePlanProgress(
  allActionIds: string[],
  completedIds: string[]
): PlanProgress {
  const total = allActionIds.length;
  if (total === 0) {
    return { completed: 0, total: 0, pct: 0 };
  }
  const doneSet = new Set(completedIds);
  const completed = allActionIds.filter((id) => doneSet.has(id)).length;
  const pct = Math.round((completed / total) * 100);
  return { completed, total, pct };
}

/**
 * Triggers a subtle tactile vibration on supported mobile devices without throwing.
 */
export function triggerHapticTap(ms = 12): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    // Ignore unsupported or blocked vibration calls
  }
}
