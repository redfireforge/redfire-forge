import { useMemo, useState, useCallback } from 'react';
import { manualMetadata, getManualMetadata } from '../../../data/galleries/trainingPaths/manualMetadata';
import { trainingPaths } from '../../../data/galleries/trainingPaths';
import type { ManualMetadata, TrainingManual, TrainingPath, TrainingPhase } from '../../../data/galleries/trainingPaths/types';

/** Number of days to consider content as "new" */
const NEW_CONTENT_DAYS = 14;

/** Maximum items to show in the What's New banner by default */
const DEFAULT_DISPLAY_LIMIT = 5;

export type WhatsNewType = 'new' | 'updated';

export interface WhatsNewItem {
  /** Type of change */
  type: WhatsNewType;
  /** Manual metadata */
  metadata: ManualMetadata;
  /** Training manual info (title, description, difficulty, sampleId) */
  manual: TrainingManual;
  /** Parent path name */
  pathName: string;
  /** Parent path icon */
  pathIcon: string;
  /** Parent phase name */
  phaseName: string;
  /** Timestamp to sort by (addedAt for new, updatedAt for updated) */
  timestamp: number;
}

/**
 * Find which path/phase a manual belongs to.
 */
function findManualContext(manualPath: string): {
  path: TrainingPath;
  phase: TrainingPhase;
  manual: TrainingManual;
} | null {
  for (const path of trainingPaths) {
    if (path.comingSoon) continue;
    for (const phase of path.phases) {
      for (const manual of phase.manuals) {
        if (manual.manualPath === manualPath) {
          return { path, phase, manual };
        }
      }
    }
  }
  return null;
}

/**
 * Get all manuals that are new or updated within the specified number of days.
 */
export function getWhatsNewItems(
  withinDays: number = NEW_CONTENT_DAYS
): WhatsNewItem[] {
  const cutoffTime = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  const items: WhatsNewItem[] = [];

  for (const meta of manualMetadata) {
    const context = findManualContext(meta.manualPath);
    if (!context) continue;

    // Check if it's new (added within cutoff)
    if (meta.addedAt >= cutoffTime) {
      items.push({
        type: 'new',
        metadata: meta,
        manual: context.manual,
        pathName: context.path.name,
        pathIcon: context.path.icon,
        phaseName: context.phase.name,
        timestamp: meta.addedAt,
      });
    }
    // Check if it's updated (updatedAt within cutoff AND after addedAt)
    else if (meta.updatedAt && meta.updatedAt >= cutoffTime && meta.updatedAt > meta.addedAt) {
      items.push({
        type: 'updated',
        metadata: meta,
        manual: context.manual,
        pathName: context.path.name,
        pathIcon: context.path.icon,
        phaseName: context.phase.name,
        timestamp: meta.updatedAt,
      });
    }
  }

  // Sort by timestamp descending (most recent first)
  items.sort((a, b) => b.timestamp - a.timestamp);

  return items;
}

/**
 * Check if a specific manual is new.
 */
export function isManualNew(
  manualPath: string,
  withinDays: number = NEW_CONTENT_DAYS
): boolean {
  const meta = getManualMetadata(manualPath);
  if (!meta) return false;
  
  const cutoffTime = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  return meta.addedAt >= cutoffTime;
}

/**
 * Check if a specific manual was updated recently.
 */
export function isManualUpdated(
  manualPath: string,
  withinDays: number = NEW_CONTENT_DAYS
): boolean {
  const meta = getManualMetadata(manualPath);
  if (!meta || !meta.updatedAt) return false;
  
  const cutoffTime = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  return meta.updatedAt >= cutoffTime && meta.updatedAt > meta.addedAt;
}

/**
 * Get the badge type for a manual (new, updated, or null).
 */
export function getManualBadge(
  manualPath: string,
  withinDays: number = NEW_CONTENT_DAYS
): WhatsNewType | null {
  if (isManualNew(manualPath, withinDays)) return 'new';
  if (isManualUpdated(manualPath, withinDays)) return 'updated';
  return null;
}

/**
 * Hook for managing "What's New" content display.
 *
 * Provides:
 * - List of new/updated manuals within the specified timeframe
 * - Collapsed/expanded state for the banner
 * - Helper functions to check if specific manuals are new/updated
 */
export function useWhatsNew(withinDays: number = NEW_CONTENT_DAYS) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Get all new/updated items
  const allItems = useMemo(
    () => getWhatsNewItems(withinDays),
    [withinDays]
  );

  // Items to display (limited unless "show all" is enabled)
  const displayedItems = useMemo(
    () => showAll ? allItems : allItems.slice(0, DEFAULT_DISPLAY_LIMIT),
    [allItems, showAll]
  );

  // Count of new vs updated
  const counts = useMemo(() => {
    let newCount = 0;
    let updatedCount = 0;
    for (const item of allItems) {
      if (item.type === 'new') newCount++;
      else updatedCount++;
    }
    return { newCount, updatedCount, total: allItems.length };
  }, [allItems]);

  // Toggle banner expanded/collapsed
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Toggle show all items
  const toggleShowAll = useCallback(() => {
    setShowAll(prev => !prev);
  }, []);

  // Check if a manual is new
  const checkIsNew = useCallback(
    (manualPath: string) => isManualNew(manualPath, withinDays),
    [withinDays]
  );

  // Check if a manual is updated
  const checkIsUpdated = useCallback(
    (manualPath: string) => isManualUpdated(manualPath, withinDays),
    [withinDays]
  );

  // Get badge type for a manual
  const getBadge = useCallback(
    (manualPath: string) => getManualBadge(manualPath, withinDays),
    [withinDays]
  );

  return {
    allItems,
    displayedItems,
    counts,
    isExpanded,
    showAll,
    hasMore: allItems.length > DEFAULT_DISPLAY_LIMIT,
    toggleExpanded,
    toggleShowAll,
    checkIsNew,
    checkIsUpdated,
    getBadge,
  };
}

export type UseWhatsNewReturn = ReturnType<typeof useWhatsNew>;
