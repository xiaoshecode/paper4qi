// Public backend address is a build setting; owner credentials exist only in memory.
export function validateApiBase(value: string): string {
  if (!value.trim()) return '';
  const raw = value.trim();
  if (/[\\\r\n]/.test(raw)) throw new Error('Invalid API address');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('PUBLIC_API_BASE_URL must be an HTTPS URL without credentials, query or fragment');
  if (/%2e|%2f|%5c/i.test(url.pathname)) throw new Error('Invalid API path prefix');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}
const configuredBase = validateApiBase(import.meta.env.PUBLIC_API_BASE_URL || '');
let ownerToken = '', tokenExpires = 0;
export function getApiBase(): string { return configuredBase; }
function resourceURL(kind: 'api' | 'data', path: string, base = import.meta.env.BASE_URL): string {
  const clean = path.replace(/^\/+/, '');
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || /[\\#\r\n]/.test(clean) || clean.split('?', 1)[0].split('/').some(segment => segment === '.' || segment === '..' || /%2e|%2f|%5c/i.test(segment))) throw new Error('Invalid backend resource path');
  return `${configuredBase || base.replace(/\/+$/, '')}/${kind}/${clean}`;
}
export function getApiURL(path: string, base?: string): string { return resourceURL('api', path, base); }
export function getDataURL(path: string, base?: string): string { return resourceURL('data', path, base); }
function notifyAuth() { if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent('p4q:authchange')); }
export function setApiToken(value: string, expiresAt?: string | number): void {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new Error('Invalid login session');
  const expires = typeof expiresAt === 'number' ? expiresAt * (expiresAt < 1e12 ? 1000 : 1) : typeof expiresAt === 'string' ? Date.parse(expiresAt) : 0;
  if (expiresAt !== undefined && (!Number.isFinite(expires) || expires <= Date.now())) throw new Error('Login session has expired');
  ownerToken = value;
  tokenExpires = expires;
  notifyAuth();
}
export function clearApiToken(): void {
  const changed = !!ownerToken || !!tokenExpires;
  ownerToken = ''; tokenExpires = 0;
  if (changed) notifyAuth();
}
export async function apiFetch(url: string, options: RequestInit = {}, localToken?: string): Promise<Response> {
  const pageOrigin = typeof location !== 'undefined' ? location.origin : undefined;
  const target = new URL(url, pageOrigin || 'https://localhost');
  const allowed = configuredBase ? new URL(configuredBase) : new URL(import.meta.env.BASE_URL, pageOrigin || 'https://localhost');
  const prefix = allowed.pathname.replace(/\/+$/, '');
  if (/[\\\r\n]/.test(url) || target.username || target.password || target.hash || /%2e|%2f|%5c/i.test(target.pathname) || target.origin !== allowed.origin || !target.pathname.startsWith(`${prefix}/api/`) && !target.pathname.startsWith(`${prefix}/data/`)) throw new Error('Refusing to send research credentials to another destination');
  if (tokenExpires && Date.now() >= tokenExpires) clearApiToken();
  const headers = new Headers(options.headers);
  headers.delete('Authorization');
  const token = ownerToken || (!configuredBase && target.origin === pageOrigin ? localToken : '');
  if (token && target.pathname.startsWith(`${prefix}/api/`)) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers, redirect: 'error', credentials: pageOrigin && target.origin !== pageOrigin ? 'omit' : 'same-origin' });
  if (ownerToken && token === ownerToken && headers.has('Authorization') && (response.status === 401 || response.status === 403)) clearApiToken();
  return response;
}
