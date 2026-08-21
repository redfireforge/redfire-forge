/**
 * Shared base type for all gallery entries across the application.
 *
 * Each feature gallery (workflow templates, assertion presets, catalog specs, etc.)
 * extends this with domain-specific fields while keeping a consistent structure
 * for filtering, searching, and rendering gallery cards.
 */

export type GalleryDifficulty = 'easy' | 'medium' | 'advanced';

export type GalleryDomain = 'requests' | 'catalog' | 'tests' | 'workflows' | 'assertions' | 'data-mapper' | 'api-mock';

/** Reference to a training manual related to a gallery sample. */
export interface RelatedManual {
  title: string;
  description: string;
  difficulty: GalleryDifficulty;
  /** Relative path from docs/training-manuals/ */
  path: string;
}

export interface GalleryEntry<T> {
  id: string;
  domain: GalleryDomain;
  name: string;
  description: string;
  icon: string;
  category: string;
  difficulty: GalleryDifficulty;
  tags: string[];
  /** The public API(s) this sample interacts with. */
  liveApis: string[];
  factory: () => T;
  /**
   * If set, marks this entry as a simulator/counterpart for another sample
   * (value is the id of the main sample). Used to group pairs in the gallery.
   */
  simulatorOf?: string;
  /**
   * Training manuals related to this sample. Built automatically from training paths
   * that reference this sample's ID via sampleId.
   */
  relatedManuals?: RelatedManual[];
}
