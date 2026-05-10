import type { GalleryDifficulty, GalleryDomain } from '../../../data/galleries/types';

export type GalleryMode = 'samples' | 'paths';

export interface GalleryFilterState {
  domain: GalleryDomain | 'all';
  category: string;
  difficulty: GalleryDifficulty | 'all';
  liveApi: string;
  tag: string;
  search: string;
}

export function defaultFilterState(): GalleryFilterState {
  return { domain: 'all', category: '', difficulty: 'all', liveApi: '', tag: '', search: '' };
}

export function apiHostname(url: string): string {
  try {
    const h = new URL(url).hostname;
    return h || url;
  } catch { return url; }
}
