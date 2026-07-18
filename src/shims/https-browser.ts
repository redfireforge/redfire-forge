// Browser stub for Node's `https`. See `http-browser.ts` — required at load
// time by offline OpenAPI tooling for remote `$ref` fetching, which this app
// never performs. Any actual call throws.

function unsupported(): never {
  throw new Error('Node https API is not available in browser runtime.');
}

export function request(): never {
  return unsupported();
}

export function get(): never {
  return unsupported();
}

const httpsShim = { request, get };
export default httpsShim;
