/**
 * useGraphqlEnvironments — Phase 1E
 *
 * Manages the list of named GraphQL environments and their variables.
 * Persists to localStorage under `gql_environments_v1`.
 *
 * Rules:
 *   • Only one environment can be active at a time (isActive: true)
 *   • When the active environment is deleted, the first remaining env auto-activates
 *   • Import supports both Postman format (values[]) and native format (variables[])
 */

import { useCallback, useEffect, useState } from 'react';
import type { GraphqlEnvironment, GraphqlEnvironmentVariable } from '../../../shared/types/graphql';

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'gql_environments_v1';

function loadEnvironments(): GraphqlEnvironment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[]).filter(
      (e): e is GraphqlEnvironment =>
        e !== null &&
        typeof e === 'object' &&
        typeof (e as Record<string, unknown>).id === 'string' &&
        typeof (e as Record<string, unknown>).name === 'string' &&
        Array.isArray((e as Record<string, unknown>).variables),
    );
  } catch {
    return [];
  }
}

function saveEnvironments(envs: GraphqlEnvironment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envs));
  } catch { /* quota exceeded or private browsing — no-op */ }
}

// ─── ID generator ─────────────────────────────────────────────────────────────

function generateEnvId(): string {
  return `env-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Variable ID generator ────────────────────────────────────────────────────

let nextVarSeq = Date.now();
export function generateVarId(): string {
  return `var-${nextVarSeq++}`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseGraphqlEnvironmentsReturn {
  environments: GraphqlEnvironment[];
  /** The environment with isActive: true, or null when none is active */
  activeEnvironment: GraphqlEnvironment | null;
  /** Create a new environment with the given name. Returns the new env's id. */
  createEnvironment: (name: string) => string;
  /** Delete an environment by id. Auto-activates the first remaining env if the deleted one was active. */
  deleteEnvironment: (id: string) => void;
  /** Set the active environment by id. Pass null to deactivate all. */
  setActiveEnvironment: (id: string | null) => void;
  /** Rename an environment. */
  updateEnvironmentName: (id: string, name: string) => void;
  /** Replace the full variables list for an environment. */
  updateVariables: (id: string, variables: GraphqlEnvironmentVariable[]) => void;
  /**
   * Import an environment from a JSON string.
   * Supports Postman format ({ values: [...] }) and native format ({ variables: [...] }).
   * The imported env is NOT set as active — user must explicitly activate it.
   */
  importEnvironment: (json: string) => { success: boolean; error?: string };
  /**
   * Export an environment as a JSON string for download.
   * Returns null if the id is not found.
   */
  exportEnvironment: (id: string) => string | null;
}

export function useGraphqlEnvironments(): UseGraphqlEnvironmentsReturn {
  const [environments, setEnvironments] = useState<GraphqlEnvironment[]>(loadEnvironments);

  // Persist on every change
  useEffect(() => {
    saveEnvironments(environments);
  }, [environments]);

  const activeEnvironment = environments.find((e) => e.isActive) ?? null;

  // ── Create ──────────────────────────────────────────────────────────────────
  const createEnvironment = useCallback((name: string): string => {
    const id = generateEnvId();
    const now = Date.now();
    const newEnv: GraphqlEnvironment = {
      id,
      name: name.trim() || 'New Environment',
      variables: [],
      isActive: false,
      createdAt: now,
      updatedAt: now,
    };
    setEnvironments((prev) => [...prev, newEnv]);
    return id;
  }, []);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteEnvironment = useCallback((id: string) => {
    setEnvironments((prev) => {
      const target = prev.find((e) => e.id === id);
      const remaining = prev.filter((e) => e.id !== id);
      // Auto-activate the first remaining env if we deleted the active one
      if (target?.isActive && remaining.length > 0) {
        return remaining.map((e, i) => ({ ...e, isActive: i === 0 }));
      }
      return remaining;
    });
  }, []);

  // ── Activate ─────────────────────────────────────────────────────────────────
  const setActiveEnvironment = useCallback((id: string | null) => {
    setEnvironments((prev) =>
      prev.map((e) => ({ ...e, isActive: e.id === id })),
    );
  }, []);

  // ── Rename ───────────────────────────────────────────────────────────────────
  const updateEnvironmentName = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setEnvironments((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, name: trimmed, updatedAt: Date.now() } : e,
      ),
    );
  }, []);

  // ── Variables ────────────────────────────────────────────────────────────────
  const updateVariables = useCallback(
    (id: string, variables: GraphqlEnvironmentVariable[]) => {
      setEnvironments((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, variables, updatedAt: Date.now() } : e,
        ),
      );
    },
    [],
  );

  // ── Import ───────────────────────────────────────────────────────────────────
  const importEnvironment = useCallback(
    (json: string): { success: boolean; error?: string } => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return { success: false, error: 'Invalid JSON — could not parse the file.' };
      }

      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Unexpected format — root must be an object.' };
      }

      const obj = parsed as Record<string, unknown>;
      const now = Date.now();
      const id = generateEnvId();

      // ── Postman format: { name, values: [{ key, value, enabled, type }] }
      if (Array.isArray(obj.values)) {
        const name = typeof obj.name === 'string' ? obj.name : 'Imported Environment';
        const variables: GraphqlEnvironmentVariable[] = (
          obj.values as Array<Record<string, unknown>>
        )
          .filter((v) => v.enabled !== false)
          .map((v) => ({
            key: String(v.key ?? ''),
            value: String(v.value ?? ''),
            enabled: true,
            masked: v.type === 'secret',
          }));
        setEnvironments((prev) => [
          ...prev,
          { id, name, variables, isActive: false, createdAt: now, updatedAt: now },
        ]);
        return { success: true };
      }

      // ── Native format: { name, variables: [{ key, value, enabled, masked? }] }
      if (typeof obj.name === 'string' && Array.isArray(obj.variables)) {
        const variables = (obj.variables as Array<Record<string, unknown>>).map((v) => ({
          key: String(v.key ?? ''),
          value: String(v.value ?? ''),
          enabled: v.enabled !== false,
          masked: v.masked === true,
        }));
        setEnvironments((prev) => [
          ...prev,
          { id, name: obj.name as string, variables, isActive: false, createdAt: now, updatedAt: now },
        ]);
        return { success: true };
      }

      return {
        success: false,
        error: 'Unrecognized format — expected Postman or native environment JSON.',
      };
    },
    [],
  );

  // ── Export ───────────────────────────────────────────────────────────────────
  const exportEnvironment = useCallback(
    (id: string): string | null => {
      const env = environments.find((e) => e.id === id);
      if (!env) return null;
      return JSON.stringify({ name: env.name, variables: env.variables }, null, 2);
    },
    [environments],
  );

  return {
    environments,
    activeEnvironment,
    createEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
    updateEnvironmentName,
    updateVariables,
    importEnvironment,
    exportEnvironment,
  };
}
