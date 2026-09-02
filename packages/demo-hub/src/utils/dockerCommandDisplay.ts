/** GitHub releases list — `/releases/latest` is Standard Edition, not Learning Hub. */
export const LEARNING_HUB_DOWNLOAD_URL =
  'https://github.com/redfireforge/redfireforge-public/releases';

export const DOCKER_DESKTOP_INSTALL_URL = 'https://www.docker.com/products/docker-desktop';

const CLONE_MARKER = 'git clone https://github.com/redfireforge/redfireforge-public.git';

const REPO_CLONE_PREAMBLE = [
  '# First time? Clone the repo:',
  `#   ${CLONE_MARKER}`,
  '#   cd redfireforge-public',
  '',
].join('\n');

/**
 * Until Phase 2 bundles `docker/` into the app, the compose command only works
 * after the user clones the public repo. Prepend those steps for the gate UI
 * and clipboard. Lesson `dockerCommand` values stay compose-only.
 */
export function withRepoClonePreamble(dockerCommand: string): string {
  if (dockerCommand.includes(CLONE_MARKER)) {
    return dockerCommand;
  }
  return `${REPO_CLONE_PREAMBLE}${dockerCommand}`;
}
