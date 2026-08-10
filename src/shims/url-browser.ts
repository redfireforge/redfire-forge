interface ParsedUrl {
  protocol: string | null;
  slashes: boolean | null;
  auth: string | null;
  host: string | null;
  port: string | null;
  hostname: string | null;
  hash: string | null;
  search: string | null;
  query: string | null;
  pathname: string | null;
  path: string | null;
  href: string;
}

function parse(urlString: string): ParsedUrl {
  try {
    const u = new URL(urlString, 'http://localhost');
    return {
      protocol: u.protocol || null,
      slashes: true,
      auth: null,
      host: u.host || null,
      port: u.port || null,
      hostname: u.hostname || null,
      hash: u.hash || null,
      search: u.search || null,
      query: u.search ? u.search.slice(1) : null,
      pathname: u.pathname || null,
      path: u.pathname + (u.search || ''),
      href: u.href,
    };
  } catch {
    return {
      protocol: null, slashes: null, auth: null, host: null,
      port: null, hostname: null, hash: null, search: null,
      query: null, pathname: urlString, path: urlString, href: urlString,
    };
  }
}

function resolve(from: string, to: string): string {
  try {
    return new URL(to, from).href;
  } catch {
    return to;
  }
}

function format(urlObj: Partial<ParsedUrl>): string {
  let result = '';
  if (urlObj.protocol) result += urlObj.protocol + '//';
  if (urlObj.host) result += urlObj.host;
  else if (urlObj.hostname) result += urlObj.hostname + (urlObj.port ? ':' + urlObj.port : '');
  if (urlObj.pathname) result += urlObj.pathname;
  if (urlObj.search) result += urlObj.search;
  if (urlObj.hash) result += urlObj.hash;
  return result || '';
}

const urlShim = { parse, resolve, format };
export { parse, resolve, format };
export default urlShim;
