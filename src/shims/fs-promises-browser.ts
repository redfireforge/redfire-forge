function unsupported(): Error {
  return new Error('Node fs/promises API is not available in browser runtime.');
}

export async function readFile(_path: string): Promise<never> {
  throw unsupported();
}

export async function writeFile(_path: string, _data: unknown): Promise<never> {
  throw unsupported();
}

export async function mkdir(_path: string, _options?: unknown): Promise<never> {
  throw unsupported();
}

const fsPromisesShim = {
  readFile,
  writeFile,
  mkdir,
};

export default fsPromisesShim;