/**
 * Phase 5 — Schema Registry Browser hook.
 *
 * Manages state for browsing a Confluent-compatible Schema Registry:
 *   - Registry URL + optional auth configuration
 *   - Subject listing with client-side substring filter
 *   - Version listing per subject with auto-select latest
 *   - Schema content fetch per subject/version
 *   - Format badge derivation from server schemaType (with content-sniffing fallback)
 *
 * All three API calls reuse existing Phase 10 server routes via dispatchKafkaOperation:
 *   - schema-subjects  → POST /api/kafka/schema-subjects
 *   - schema-versions  → POST /api/kafka/schema-versions
 *   - schema-fetch     → POST /api/kafka/schema-fetch
 */

import { useState, useCallback, useMemo } from 'react';
import {
  dispatchKafkaOperation,
  toKafkaUiSafeError,
  type KafkaUiSafeError,
} from '@shared/kafka/kafkaClient';
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';

export interface SchemaRegistryConfig {
  registryUrl: string;
  auth?: { username: string; password: string };
}

export type SchemaFormat = 'avro' | 'protobuf' | 'json-schema';

export interface SchemaSubjectRow {
  name: string;
  format?: SchemaFormat;
}

export interface SchemaVersionDetail {
  subject: string;
  version: number;
  id: number;
  schema: string;
  schemaType?: string;
}

export interface UseSchemaRegistryReturn {
  registryConfig: SchemaRegistryConfig;
  setRegistryConfig: (patch: Partial<SchemaRegistryConfig>) => void;

  subjects: SchemaSubjectRow[];
  subjectsLoading: boolean;
  subjectsError: KafkaUiSafeError | null;
  loadSubjects: () => Promise<void>;
  hasLoadedOnce: boolean;

  filter: string;
  setFilter: (f: string) => void;
  filteredSubjects: SchemaSubjectRow[];

  selectedSubject: string | null;
  selectSubject: (name: string | null) => void;

  versions: number[];
  versionsLoading: boolean;
  versionsError: KafkaUiSafeError | null;

  selectedVersion: number | null;
  selectVersion: (v: number | null) => void;

  schemaDetail: SchemaVersionDetail | null;
  schemaLoading: boolean;
  schemaError: KafkaUiSafeError | null;
}

export interface UseSchemaRegistryDeps {
  dispatch?: typeof dispatchKafkaOperation;
}

/**
 * Derive format from server-returned schemaType, falling back to content sniffing.
 */
export function deriveSchemaFormat(
  schemaType?: string,
  schemaContent?: string,
): SchemaFormat | undefined {
  if (schemaType) {
    const upper = schemaType.toUpperCase();
    if (upper === 'AVRO') return 'avro';
    if (upper === 'PROTOBUF') return 'protobuf';
    if (upper === 'JSON') return 'json-schema';
  }
  if (!schemaContent) return undefined;
  try {
    const parsed = JSON.parse(schemaContent);
    if (parsed && typeof parsed === 'object') {
      if ('$schema' in parsed) return 'json-schema';
      if (parsed.type === 'record') return 'avro';
    }
  } catch {
    return 'protobuf';
  }
  return undefined;
}

function buildSchemaConfig(config: SchemaRegistryConfig): Record<string, unknown> {
  const sc: Record<string, unknown> = { registryUrl: config.registryUrl };
  if (config.auth && (config.auth.username || config.auth.password)) {
    sc.auth = { username: config.auth.username, password: config.auth.password };
  }
  return sc;
}

export function useSchemaRegistry(
  _kafkaState: UseKafkaStateReturn,
  deps?: UseSchemaRegistryDeps,
): UseSchemaRegistryReturn {
  const dispatch = deps?.dispatch ?? dispatchKafkaOperation;

  const [registryConfig, setRegistryConfigState] = useState<SchemaRegistryConfig>({
    registryUrl: '',
  });
  const [subjects, setSubjects] = useState<SchemaSubjectRow[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<KafkaUiSafeError | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [filter, setFilter] = useState('');

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const [versions, setVersions] = useState<number[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<KafkaUiSafeError | null>(null);

  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const [schemaDetail, setSchemaDetail] = useState<SchemaVersionDetail | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<KafkaUiSafeError | null>(null);

  const setRegistryConfig = useCallback((patch: Partial<SchemaRegistryConfig>) => {
    setRegistryConfigState((prev) => ({ ...prev, ...patch }));
  }, []);

  const filteredSubjects = useMemo(() => {
    if (!filter.trim()) return subjects;
    const lower = filter.toLowerCase();
    return subjects.filter((s) => s.name.toLowerCase().includes(lower));
  }, [subjects, filter]);

  const fetchSchemaForVersion = useCallback(
    async (subject: string, version: number, config: SchemaRegistryConfig) => {
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const envelope = await dispatch<SchemaVersionDetail>('schema-fetch', {
          schemaConfig: buildSchemaConfig(config),
          subject,
          version,
        });
        const detail = envelope.data ?? null;
        setSchemaDetail(detail);

        if (detail) {
          const fmt = deriveSchemaFormat(detail.schemaType, detail.schema);
          if (fmt) {
            setSubjects((prev) =>
              prev.map((s) => (s.name === subject ? { ...s, format: fmt } : s)),
            );
          }
        }
      } catch (err) {
        setSchemaError(toKafkaUiSafeError(err, 'schema-fetch'));
        setSchemaDetail(null);
      } finally {
        setSchemaLoading(false);
      }
    },
    [dispatch],
  );

  const selectVersion = useCallback(
    (v: number | null) => {
      setSelectedVersion(v);
      if (v != null && selectedSubject) {
        void fetchSchemaForVersion(selectedSubject, v, registryConfig);
      }
    },
    [selectedSubject, registryConfig, fetchSchemaForVersion],
  );

  const selectSubject = useCallback(
    (name: string | null) => {
      setSelectedSubject(name);
      setVersions([]);
      setSelectedVersion(null);
      setSchemaDetail(null);
      setVersionsError(null);
      setSchemaError(null);

      if (!name) return;

      setVersionsLoading(true);
      dispatch<{ subject: string; versions: number[] }>('schema-versions', {
        schemaConfig: buildSchemaConfig(registryConfig),
        subject: name,
      })
        .then((envelope) => {
          const versionList = envelope.data?.versions ?? [];
          setVersions(versionList);
          setVersionsLoading(false);
          if (versionList.length > 0) {
            // "Latest" is the highest version number, not merely the last
            // array element — the registry is not guaranteed to return
            // versions in ascending order.
            const latest = Math.max(...versionList);
            setSelectedVersion(latest);
            void fetchSchemaForVersion(name, latest, registryConfig);
          }
        })
        .catch((err) => {
          setVersionsError(toKafkaUiSafeError(err, 'schema-versions'));
          setVersionsLoading(false);
        });
    },
    [registryConfig, dispatch, fetchSchemaForVersion],
  );

  const loadSubjects = useCallback(async () => {
    if (!registryConfig.registryUrl.trim()) return;
    setSubjectsLoading(true);
    setSubjectsError(null);
    setSelectedSubject(null);
    setVersions([]);
    setSelectedVersion(null);
    setSchemaDetail(null);
    try {
      const envelope = await dispatch<{ subjects: Array<string | { name: string; schemaType?: string }> }>('schema-subjects', {
        schemaConfig: buildSchemaConfig(registryConfig),
      });
      const raw = envelope.data?.subjects ?? [];
      setSubjects(raw.map((entry) => {
        if (typeof entry === 'string') return { name: entry };
        const fmt = deriveSchemaFormat(entry.schemaType, undefined);
        return { name: entry.name, format: fmt };
      }));
      setHasLoadedOnce(true);
    } catch (err) {
      setSubjectsError(toKafkaUiSafeError(err, 'schema-subjects'));
    } finally {
      setSubjectsLoading(false);
    }
  }, [registryConfig, dispatch]);

  return {
    registryConfig,
    setRegistryConfig,
    subjects,
    subjectsLoading,
    subjectsError,
    loadSubjects,
    hasLoadedOnce,
    filter,
    setFilter,
    filteredSubjects,
    selectedSubject,
    selectSubject,
    versions,
    versionsLoading,
    versionsError,
    selectedVersion,
    selectVersion,
    schemaDetail,
    schemaLoading,
    schemaError,
  };
}
