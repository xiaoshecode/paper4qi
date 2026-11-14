// Execute the real browser API client inside existing offline controller VMs.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = createRequire(require.resolve('astro/package.json'))('typescript');
const original = readFileSync(new URL('../src/scripts/api-client.ts', import.meta.url), 'utf8');

export function apiClientCode(settings = {}) {
  const env = { BASE_URL: '/paper4qi/', PUBLIC_API_BASE_URL: '', ...settings };
  return ts.transpileModule(original.replaceAll('import.meta.env', JSON.stringify(env)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
}

export function inlineApiClient(source, settings = {}) {
  return source.replace(/^import \{([^}]+)\} from '\.\/api-client';$/m, (_line, imports) =>
    `const {${imports}} = (() => { const exports = {};\n${apiClientCode(settings)}\nreturn exports; })();`);
}
