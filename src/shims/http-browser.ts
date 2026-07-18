// Browser stub for Node's `http`. Offline OpenAPI tooling (openapi-format)
// requires this module at load time only to support remote `$ref` fetching,
// which this app never uses (all conversion runs on in-memory documents).
// Any actual call throws so accidental network use surfaces loudly.

function unsupported(): never {
  throw new Error('Node http API is not available in browser runtime.');
}

export function request(): never {
  return unsupported();
}

export function get(): never {
  return unsupported();
}

const httpShim = { request, get };
export default httpShim;
