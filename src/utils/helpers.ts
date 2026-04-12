import { v4 as uuidv4 } from 'uuid';
import type { Project } from '../types';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function createEmptyProject(name: string, description?: string): Project {
  return {
    id: uuidv4(),
    name,
    description,
    createdAt: Date.now(),
    environments: [],
    microservices: [],
    globalAuthProfiles: [],
    featureGroups: [],
  };
}
