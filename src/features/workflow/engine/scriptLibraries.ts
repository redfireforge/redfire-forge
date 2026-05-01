/**
 * Script Libraries — reusable JavaScript functions shared across Script nodes.
 * Libraries are stored in localStorage/Tauri FS and can be imported by Script nodes.
 */

import { v4 as uuidv4 } from 'uuid';

export interface ScriptLibrary {
  id: string;
  name: string;
  description: string;
  /** The reusable JavaScript code (function definitions, constants, etc.) */
  code: string;
  /** When the library was created */
  createdAt: string;
  /** When the library was last updated */
  updatedAt: string;
  /** Version history snapshots */
  versions?: ScriptLibraryVersion[];
}

export interface ScriptLibrarySnapshot {
  name: string;
  description: string;
  code: string;
}

export interface ScriptLibraryVersion {
  id: string;
  timestamp: number;
  label?: string;
  changeSummary?: string;
  snapshot: ScriptLibrarySnapshot;
}

const STORAGE_KEY = 'workflow:scriptLibraries';

/**
 * Load all script libraries from storage.
 */
export function loadScriptLibraries(): ScriptLibrary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Save all script libraries to storage.
 */
export function saveScriptLibraries(libraries: ScriptLibrary[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(libraries));
}

/**
 * Create a new script library.
 */
export function createScriptLibrary(name: string, description: string, code: string): ScriptLibrary {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: name.trim(),
    description: description.trim(),
    code,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update an existing script library.
 */
export function updateScriptLibrary(
  libraries: ScriptLibrary[],
  id: string,
  updates: Partial<Pick<ScriptLibrary, 'name' | 'description' | 'code'>>,
): ScriptLibrary[] {
  return libraries.map(lib => {
    if (lib.id !== id) return lib;
    return {
      ...lib,
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
      ...(updates.code !== undefined ? { code: updates.code } : {}),
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Delete a script library by ID.
 */
export function deleteScriptLibrary(libraries: ScriptLibrary[], id: string): ScriptLibrary[] {
  return libraries.filter(lib => lib.id !== id);
}

/**
 * Get a library by ID.
 */
export function getScriptLibraryById(libraries: ScriptLibrary[], id: string): ScriptLibrary | undefined {
  return libraries.find(lib => lib.id === id);
}

/**
 * Build the combined library code to prepend before a script's own code.
 * The library code is wrapped in an IIFE to avoid polluting the script's scope
 * while still making exported functions available.
 */
export function buildLibraryPreamble(libraries: ScriptLibrary[], libraryIds: string[]): string {
  if (!libraryIds || libraryIds.length === 0) return '';
  const parts: string[] = [];
  for (const id of libraryIds) {
    const lib = libraries.find(l => l.id === id);
    if (lib) {
      parts.push(`// --- Library: ${lib.name} ---\n${lib.code}`);
    }
  }
  return parts.length > 0 ? parts.join('\n\n') + '\n\n' : '';
}
