import { buildOutboundUrl, buildSearchUrl, partnersInGroup, OUTBOUND_PARTNERS } from '../dist/outbound.js';

console.log('[Test: Outbound Helper] Verifying partner tagging and URL safety...');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failures++;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// Fake registry with fake IDs: real tags are not filled in until partner programmes are approved.
const fake = [
  { id: 'alpha', name: 'Alpha', hosts: ['alpha.example'], mode: 'query-params', params: { ref: 'acam' }, enabled: true },
  { id: 'beta', name: 'Beta', hosts: ['beta.example'], mode: 'query-params', params: { campid: '123', toolid: '10001' }, enabled: true },
  { id: 'gamma', name: 'Gamma', hosts: ['gamma.example'], mode: 'query-params', params: { ref: 'acam' }, enabled: false },
  { id: 'delta', name: 'Delta', hosts: ['delta.example'], mode: 'none', enabled: true },
];

const build = (url) => buildOutboundUrl(url, fake);

console.log('\n--- Tagging ---');
let link = build('https://alpha.example/search?q=laptop');
assert(link?.tagged === true && link.partnerId === 'alpha', 'Registered enabled partner is tagged');
assert(link?.url === 'https://alpha.example/search?q=laptop&ref=acam', 'Tag appended after existing params');

link = build('https://alpha.example/');
assert(link?.url === 'https://alpha.example/?ref=acam', 'Tag added to URL without a query');

link = build('https://beta.example/s?x=1');
assert(link?.url === 'https://beta.example/s?x=1&campid=123&toolid=10001', 'Multi-param tagging appends every param');

link = build('https://alpha.example/s?ref=someone-else&q=a');
assert(link?.url === 'https://alpha.example/s?q=a&ref=acam', 'Existing tag of ours is replaced, not duplicated');

link = build('https://alpha.example/s?q=a&ref=x&ref=y');
assert((link?.url.match(/ref=/g) ?? []).length === 1, 'All pre-existing copies of the tag are removed');

link = build('https://alpha.example/s?f=2000|2500&q=a%20b');
assert(link?.url.includes('f=2000|2500') && link.url.includes('q=a%20b'), 'Other params keep their original encoding');

link = build('https://alpha.example/s?q=a#section-2');
assert(link?.url === 'https://alpha.example/s?q=a&ref=acam#section-2', 'Hash fragment is preserved after the tag');

link = build('HTTPS://ALPHA.EXAMPLE/s');
assert(link?.tagged === true, 'Mixed-case host is matched');

link = build('https://www.shop.alpha.example/s');
assert(link?.tagged === true && link.partnerId === 'alpha', 'Subdomains of a partner are matched');

link = build('https://alpha.example.:8443/s');
assert(link?.tagged === true, 'Trailing dot and port do not defeat host matching');

console.log('\n--- Lookalike and untagged cases ---');
for (const bad of [
  'https://evilalpha.example/s',
  'https://alpha.example.evil.net/s',
  'https://evil.net/alpha.example',
  'https://alpha.example@evil.net/s',
]) {
  link = build(bad);
  assert(link !== null && link.tagged === false && link.partnerId === null, `Lookalike host not tagged: ${bad}`);
}

link = build('https://gamma.example/s?q=a');
assert(link?.tagged === false && link.partnerId === 'gamma' && link.url === 'https://gamma.example/s?q=a', 'Disabled partner stays untagged and unchanged');

link = build('https://delta.example/s');
assert(link?.tagged === false && link.partnerId === 'delta', 'Mode "none" partner is registered but untagged');

link = build('https://unknown.example/s?q=a');
assert(link?.tagged === false && link.partnerId === null && link.url === 'https://unknown.example/s?q=a', 'Unregistered host passes through untagged');

console.log('\n--- Refused input ---');
for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'chrome://settings', 'not a url', '', '//alpha.example/s']) {
  assert(build(bad) === null, `Refused: ${JSON.stringify(bad)}`);
}

console.log('\n--- Real registry ---');
const ids = OUTBOUND_PARTNERS.map((p) => p.id);
assert(new Set(ids).size === ids.length, 'Partner IDs are unique');
const hosts = OUTBOUND_PARTNERS.flatMap((p) => p.hosts);
assert(new Set(hosts).size === hosts.length, 'No host is claimed by two partners');
assert(
  OUTBOUND_PARTNERS.every((p) => !p.enabled || (p.mode === 'query-params' && p.params && Object.keys(p.params).length > 0)),
  'Every enabled partner has a mode and non-empty params'
);
assert(
  OUTBOUND_PARTNERS.every((p) => !p.params || Object.values(p.params).every((v) => v && !/TODO|PLACEHOLDER|XXX/i.test(v))),
  'No placeholder tag values in the real registry'
);

const circular = partnersInGroup('circular_marketplace');
assert(circular.length === 3, 'Circular marketplace group has Back Market, eBay Refurbished, Swappa');
for (const partner of circular) {
  const url = buildSearchUrl(partner, 'ThinkPad T14 & case');
  const built = buildOutboundUrl(url);
  assert(
    built !== null && built.partnerId === partner.id && url.includes(encodeURIComponent('ThinkPad T14 & case')),
    `${partner.name}: search URL resolves to its own registry entry with the query encoded`
  );
}

console.log('----------------------------------------------------');
if (failures > 0) {
  console.error(`[Test: Outbound Helper] FAILED with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('[Test: Outbound Helper] ALL CHECKS PASSED.');
}
