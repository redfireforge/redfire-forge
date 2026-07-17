type FsCallback<T = unknown> = (err: Error | null, data?: T) => void;

function unsupported(): Error {
  return new Error('Node fs API is not available in browser runtime.');
}

export function readFile(_path: string, cb?: FsCallback<string | Uint8Array>): void {
  cb?.(unsupported());
}

export function readFileSync(_path: string): never {
  throw unsupported();
}

export function existsSync(_path: string): boolean {
  return false;
}

export const promises = {
  readFile: async (_path: string): Promise<never> => {
    throw unsupported();
  },
};

const fsShim = {
  readFile,
  readFileSync,
  existsSync,
  promises,
};

export default fsShim;
