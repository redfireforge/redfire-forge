import { describe, it, expect } from 'vitest';
import { withRepoClonePreamble } from './dockerCommandDisplay';

const COMPOSE = 'cd docker/graphql && docker compose up -d';
const CLONE = 'git clone https://github.com/redfireforge/redfireforge-public.git';

describe('withRepoClonePreamble', () => {
  it('prepends clone comments and keeps the compose line', () => {
    const displayed = withRepoClonePreamble(COMPOSE);
    expect(displayed).toContain('# First time? Clone the repo:');
    expect(displayed).toContain(CLONE);
    expect(displayed).toContain('#   cd redfireforge-public');
    expect(displayed.endsWith(COMPOSE)).toBe(true);
  });

  it('is idempotent when the clone URL is already present', () => {
    const once = withRepoClonePreamble(COMPOSE);
    expect(withRepoClonePreamble(once)).toBe(once);
  });
});
