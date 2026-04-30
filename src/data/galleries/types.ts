/**
 * Shared base type for all gallery entries across the application.
 *
 * Each feature gallery (workflow templates, assertion presets, catalog specs, etc.)
 * extends this with domain-specific fields while keeping a consistent structure
 * for filtering, searching, and rendering gallery cards.
 */

export type GalleryDifficulty = 'easy' | 'medium' | 'advanced';

export type GalleryDomain = 'requests' | 'catalog' | 'tests' | 'workflows' | 'assertions';

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
}
