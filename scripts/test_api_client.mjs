// Destination confinement, CORS and in-memory session regressions; no network.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { apiClientCode } from './lib_api_client_test.mjs';

function client({ backend = 'https://api.example.invalid/paper4qi', base = '/paper4qi/', page = 'https://xiaoshecode.github.io' } = {}) {
  const calls = [], events = [];
  let instant = Date.now(), status = 200;
  const context = {
    exports: {}, URL, Headers, Date: { now: () => instant }, location: { origin: page },
    CustomEvent: class { constructor(type) { this.type = type; } },
    window: { dispatchEvent(event) { events.push(event.type); } },
    fetch: async (url, options) => { calls.push({ url, options }); return new Response('{}', { status }); },
  };
  vm.runInNewContext(apiClientCode({ PUBLIC_API_BASE_URL: backend, BASE_URL: base }), context);
  return { ...context.exports, calls, events, advance(ms) { instant += ms; }, response(code) { status = code; } };
}
const api = client();
assert.equal(api.getApiBase(), 'https://api.example.invalid/paper4qi');
assert.equal(api.getApiURL('auth/login'), 'https://api.example.invalid/paper4qi/api/auth/login');
assert.equal(api.getDataURL('qce.json'), 'https://api.example.invalid/paper4qi/data/qce.json');
assert.equal(api.validateApiBase(' https://api.example.invalid/paper4qi/ '), api.getApiBase());
for (const value of ['http://api.example.invalid', 'https://user:password@api.example.invalid', 'https://api.example.invalid?key=x', 'https://api.example.invalid/#fragment', 'https://api.example.invalid/paper4qi%2fdata', 'https://api.example.invalid/back\\door']) assert.throws(() => api.validateApiBase(value));
for (const path of ['../secret', 'data/../secret', '%2e%2e/secret', 'https://other.example.invalid/api/status', 'auth\\login', 'auth/login#fragment']) assert.throws(() => api.getApiURL(path));
const token = 'a'.repeat(64);
api.setApiToken(token, Date.now() / 1000 + 3600);
await api.apiFetch(api.getApiURL('status'), { headers: { Authorization: 'Bearer supplied-other-token' }, credentials: 'include' }, 'local-token');
assert.equal(api.calls.at(-1).options.headers.get('Authorization'), 'Bearer ' + token);
assert.equal(api.calls.at(-1).options.credentials, 'omit', 'Cross-site pages do not depend on third-party cookies');
assert.equal(api.calls.at(-1).options.redirect, 'error', 'A redirect cannot forward the research session to another host');
await api.apiFetch(api.getDataURL('papers.json'), { headers: { Authorization: 'Bearer supplied-other-token' } });
assert.equal(api.calls.at(-1).options.headers.get('Authorization'), null, 'Public data requests carry no editing session');
const previous = api.calls.length;
for (const url of ['https://attacker.example.invalid/api/status', 'https://api.example.invalid/paper4qi-other/api/status', 'https://api.example.invalid/paper4qi/api/%2e%2e/secret', 'https://fake:password@api.example.invalid/paper4qi/api/status']) await assert.rejects(api.apiFetch(url));
assert.equal(api.calls.length, previous);
api.advance(3601000); await api.apiFetch(api.getApiURL('status'));
assert.equal(api.calls.at(-1).options.headers.get('Authorization'), null, 'Expired sessions stop authorizing requests');
assert.throws(() => api.setApiToken('not-a-session'));
assert.throws(() => api.setApiToken(token, 'not-a-date'));
api.setApiToken(token); api.response(401); await api.apiFetch(api.getApiURL('article?id=one'));
api.response(200); await api.apiFetch(api.getApiURL('status'));
assert.equal(api.calls.at(-1).options.headers.get('Authorization'), null, 'Rejected sessions are cleared');
const eventCount = api.events.length; api.clearApiToken(); api.clearApiToken();
assert.equal(api.events.length, eventCount, 'Clearing an already-empty session does not create a request loop');
const local = client({ backend: '', page: 'http://127.0.0.1:8765' });
assert.equal(local.getApiURL('status'), '/paper4qi/api/status');
await local.apiFetch(local.getApiURL('papers'), {}, 'temporary-local-token');
assert.equal(local.calls.at(-1).options.headers.get('Authorization'), 'Bearer temporary-local-token');
assert.equal(local.calls.at(-1).options.credentials, 'same-origin');
const sites = client({ backend: '', base: '/', page: 'https://site.example.invalid' });
assert.equal(sites.getApiURL('status'), '/api/status');
assert.equal(sites.getDataURL('papers.json'), '/data/papers.json');
await sites.apiFetch('/api/status');
assert.equal(sites.calls.at(-1).options.credentials, 'same-origin');
assert.equal(sites.calls.at(-1).options.headers.get('Authorization'), null);
console.log('PASS: configured HTTPS API prefixes, confined in-memory owner tokens, CORS without third-party cookies, public data isolation, expiry/revocation and Sites/local compatibility.');
