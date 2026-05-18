/**
 * Synonym dictionary for semantic field-name matching.
 *
 * Groups of conceptually equivalent field names across naming conventions.
 * Used by autoMapAlgorithm's synonym matching tier.
 *
 * IMPORTANT: Each word must appear in exactly ONE group to avoid unintended
 * cross-group merging (e.g., "state" as US-state vs status).
 */

const SYNONYM_GROUPS: readonly string[][] = [
  ['price', 'msrp', 'cost', 'amount', 'amt', 'total', 'subtotal'],
  ['quantity', 'qty', 'count', 'num'],
  ['firstname', 'fname', 'first', 'givenname'],
  ['lastname', 'lname', 'last', 'surname', 'familyname'],
  ['name', 'fullname', 'displayname'],
  ['dateofbirth', 'dob', 'birthday', 'birthdate'],
  ['description', 'desc', 'summary', 'details', 'detail'],
  ['address', 'addr', 'street', 'streetaddress'],
  ['phone', 'tel', 'telephone', 'mobile', 'cell', 'phonenumber'],
  ['email', 'emailaddress', 'mail'],
  ['image', 'img', 'photo', 'picture', 'avatar', 'thumbnail'],
  ['number', 'no', 'identifier'],
  ['created', 'createdat', 'createddate', 'creationdate', 'datecreated'],
  ['updated', 'updatedat', 'updateddate', 'modifieddate', 'datemodified', 'lastmodified'],
  ['deleted', 'deletedat', 'deleteddate'],
  ['username', 'user', 'login', 'userid'],
  ['password', 'pass', 'passwd', 'pwd'],
  ['country', 'countrycode', 'nation'],
  ['city', 'town', 'locality'],
  ['state', 'province', 'region'],
  ['zipcode', 'zip', 'postalcode', 'postcode'],
  ['url', 'link', 'href', 'uri', 'endpoint'],
  ['title', 'heading', 'label', 'caption'],
  ['message', 'msg', 'text', 'content', 'body'],
  ['status', 'condition'],
  ['type', 'kind', 'category', 'class'],
  ['enabled', 'active', 'isactive', 'isenabled'],
  ['disabled', 'inactive', 'isdisabled'],
  ['currency', 'currencycode'],
  ['company', 'organization', 'org', 'firm'],
  ['latitude', 'lat'],
  ['longitude', 'lng', 'lon', 'long'],
  ['width', 'w'],
  ['height', 'h'],
  ['color', 'colour'],
  ['size', 'sz', 'dimension'],
  ['weight', 'wt', 'mass'],
  ['response', 'reply', 'result'],
  ['request', 'req'],
  ['error', 'err', 'fault', 'failure'],
  ['success', 'ok', 'passed'],
  ['token', 'accesstoken', 'authtoken', 'apikey'],
  ['timestamp', 'ts', 'time', 'datetime'],
  ['id', 'ident'],
];

const synonymIndex = new Map<string, Set<string>>();

for (const group of SYNONYM_GROUPS) {
  const shared = new Set(group);
  for (const word of group) {
    synonymIndex.set(word, shared);
  }
}

/**
 * Look up synonyms for a normalized field name.
 * Returns the set of all equivalent names (including the input itself),
 * or undefined if no synonyms are known.
 */
export function getSynonyms(normalizedName: string): ReadonlySet<string> | undefined {
  return synonymIndex.get(normalizedName);
}

/**
 * Check whether two normalized field names are synonyms of each other.
 */
export function areSynonyms(a: string, b: string): boolean {
  if (a === b) return true;
  const group = synonymIndex.get(a);
  return group != null && group.has(b);
}

/** Exposed for testing / extension. */
export const BUILT_IN_SYNONYM_GROUPS = SYNONYM_GROUPS;
