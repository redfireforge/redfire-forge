/**
 * Generate a simple hash string from a gallery sample's factory output.
 * Used to detect when a gallery sample has been updated since it was imported.
 */
export function gallerySampleHash(factoryOutput: unknown): string {
  const json = JSON.stringify(factoryOutput);
  // Simple djb2 hash — fast, deterministic, good enough for change detection
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash + json.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
