/**
 * DiffService
 * Service for computing differences between environment variable sets
 */
import { Injectable } from '@angular/core';
import { Variable } from '../models';

export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DiffEntry {
  type: DiffType;
  key: string;
  leftValue: string | null;
  rightValue: string | null;
  leftVariable: Variable | null;
  rightVariable: Variable | null;
}

export interface DiffResult {
  added: DiffEntry[];
  removed: DiffEntry[];
  modified: DiffEntry[];
  unchanged: DiffEntry[];
}

@Injectable({
  providedIn: 'root',
})
export class DiffService {
  /**
   * Computes the difference between two sets of environment variables
   * @param leftVariables - Variables from the left/source environment
   * @param rightVariables - Variables from the right/target environment
   * @returns DiffResult containing categorized differences
   */
  computeDiff(leftVariables: Variable[], rightVariables: Variable[]): DiffResult {
    const result: DiffResult = {
      added: [],
      removed: [],
      modified: [],
      unchanged: [],
    };

    // Create maps for efficient lookup
    const leftMap = new Map<string, Variable>();
    const rightMap = new Map<string, Variable>();

    leftVariables.forEach(v => leftMap.set(v.key, v));
    rightVariables.forEach(v => rightMap.set(v.key, v));

    // Get all unique keys from both environments
    const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()]);

    // Compare each key
    allKeys.forEach(key => {
      const leftVar = leftMap.get(key);
      const rightVar = rightMap.get(key);

      if (!leftVar && rightVar) {
        // Variable exists only in right environment (added)
        result.added.push({
          type: 'added',
          key,
          leftValue: null,
          rightValue: rightVar.value,
          leftVariable: null,
          rightVariable: rightVar,
        });
      } else if (leftVar && !rightVar) {
        // Variable exists only in left environment (removed)
        result.removed.push({
          type: 'removed',
          key,
          leftValue: leftVar.value,
          rightValue: null,
          leftVariable: leftVar,
          rightVariable: null,
        });
      } else if (leftVar && rightVar) {
        // Variable exists in both environments
        if (leftVar.value !== rightVar.value) {
          // Values are different (modified)
          result.modified.push({
            type: 'modified',
            key,
            leftValue: leftVar.value,
            rightValue: rightVar.value,
            leftVariable: leftVar,
            rightVariable: rightVar,
          });
        } else {
          // Values are the same (unchanged)
          result.unchanged.push({
            type: 'unchanged',
            key,
            leftValue: leftVar.value,
            rightValue: rightVar.value,
            leftVariable: leftVar,
            rightVariable: rightVar,
          });
        }
      }
    });

    // Sort each category alphabetically by key
    result.added.sort((a, b) => a.key.localeCompare(b.key));
    result.removed.sort((a, b) => a.key.localeCompare(b.key));
    result.modified.sort((a, b) => a.key.localeCompare(b.key));
    result.unchanged.sort((a, b) => a.key.localeCompare(b.key));

    return result;
  }

  /**
   * Formats a diff result as a human-readable text summary
   * @param diffResult - The diff result to format
   * @param leftEnvName - Name of the left environment
   * @param rightEnvName - Name of the right environment
   * @returns Formatted text summary
   */
  formatDiffSummary(
    diffResult: DiffResult,
    leftEnvName: string,
    rightEnvName: string
  ): string {
    const lines: string[] = [];

    lines.push(`# Environment Comparison: ${leftEnvName} ↔ ${rightEnvName}`);
    lines.push('');
    lines.push('## Summary');
    lines.push(`- Added: ${diffResult.added.length}`);
    lines.push(`- Removed: ${diffResult.removed.length}`);
    lines.push(`- Modified: ${diffResult.modified.length}`);
    lines.push(`- Unchanged: ${diffResult.unchanged.length}`);
    lines.push('');

    if (diffResult.added.length > 0) {
      lines.push('## Added Variables (in right only)');
      diffResult.added.forEach(entry => {
        lines.push(`+ ${entry.key} = ${entry.rightValue}`);
      });
      lines.push('');
    }

    if (diffResult.removed.length > 0) {
      lines.push('## Removed Variables (in left only)');
      diffResult.removed.forEach(entry => {
        lines.push(`- ${entry.key} = ${entry.leftValue}`);
      });
      lines.push('');
    }

    if (diffResult.modified.length > 0) {
      lines.push('## Modified Variables');
      diffResult.modified.forEach(entry => {
        lines.push(`~ ${entry.key}`);
        lines.push(`  Left:  ${entry.leftValue}`);
        lines.push(`  Right: ${entry.rightValue}`);
      });
      lines.push('');
    }

    if (diffResult.unchanged.length > 0) {
      lines.push('## Unchanged Variables');
      diffResult.unchanged.forEach(entry => {
        lines.push(`= ${entry.key} = ${entry.leftValue}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Calculates statistics for a diff result
   * @param diffResult - The diff result to analyze
   * @returns Statistics object
   */
  getDiffStats(diffResult: DiffResult): {
    totalChanges: number;
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    unchangedCount: number;
    totalVariables: number;
  } {
    const addedCount = diffResult.added.length;
    const removedCount = diffResult.removed.length;
    const modifiedCount = diffResult.modified.length;
    const unchangedCount = diffResult.unchanged.length;
    const totalChanges = addedCount + removedCount + modifiedCount;
    const totalVariables = totalChanges + unchangedCount;

    return {
      totalChanges,
      addedCount,
      removedCount,
      modifiedCount,
      unchangedCount,
      totalVariables,
    };
  }

  /**
   * Filters diff entries by search query
   * @param entries - Diff entries to filter
   * @param searchQuery - Search query string
   * @returns Filtered entries
   */
  filterBySearch(entries: DiffEntry[], searchQuery: string): DiffEntry[] {
    if (!searchQuery.trim()) {
      return entries;
    }

    const query = searchQuery.toLowerCase();
    return entries.filter(entry => {
      const keyMatch = entry.key.toLowerCase().includes(query);
      const leftValueMatch = entry.leftValue?.toLowerCase().includes(query) ?? false;
      const rightValueMatch = entry.rightValue?.toLowerCase().includes(query) ?? false;
      return keyMatch || leftValueMatch || rightValueMatch;
    });
  }

  /**
   * Filters diff entries by type
   * @param diffResult - Complete diff result
   * @param filterType - Type to filter by ('all', 'added', 'removed', 'modified', 'unchanged')
   * @returns Filtered entries
   */
  filterByType(diffResult: DiffResult, filterType: string): DiffEntry[] {
    switch (filterType) {
      case 'added':
        return diffResult.added;
      case 'removed':
        return diffResult.removed;
      case 'modified':
        return diffResult.modified;
      case 'unchanged':
        return diffResult.unchanged;
      case 'all':
      default:
        return [
          ...diffResult.added,
          ...diffResult.removed,
          ...diffResult.modified,
          ...diffResult.unchanged,
        ];
    }
  }
}
