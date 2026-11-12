import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = createRequire(require.resolve('astro/package.json'))('typescript');
const source = readFileSync(new URL('../src/data/navigation.ts', import.meta.url), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, context);
const { navigation, matchesDestination: match } = context.exports;
assert.equal(navigation.length, 5);
assert.equal(navigation.filter(n => n.children).length, 3);
const links = navigation.flatMap(n => n.children || [n]);
const expected = ['', 'workspace/', 'qce/', 'tqe/', 'venues/', 'stats/', 'research/', 'cs4q/', 'openqasm/', 'agents/', 'about/'];
assert.equal(new Set(links.map(l => l.path)).size, 11);
assert.deepEqual([...links.map(l => l.path)].sort(), [...expected].sort());
for (const base of ['/paper4qi/', '/']) {
  for (const path of expected) {
    assert.ok(match(base + path, base, path));
    assert.equal(links.filter(l => match(base + path, base, l.path)).length, 1);
  }
  assert.ok(match(base + 'research/control/', base, 'research/'));
  assert.ok(!match(base + 'research-other/', base, 'research/'));
  assert.ok(!match(base + 'stats-old/', base, 'stats/'));
  assert.ok(!match(base + 'qce/', base, ''));
}
if (process.argv.includes('--built')) {
  for (const path of expected) {
    const file = new URL('../dist/' + path + 'index.html', import.meta.url);
    assert.ok(existsSync(file), `Built destination exists: ${path}`);
    const header = readFileSync(file, 'utf8').match(/<header\b[\s\S]*?<\/header>/)[0];
    for (const target of expected) assert.ok(header.includes(`href="/paper4qi/${target}"`));
    assert.equal((header.match(/aria-current="page"/g) || []).length, 1, path);
    assert.ok(header.includes('class="navigation-shell" open'));
    assert.equal((header.match(/class="nav-group(?: is-current)?"/g) || []).length, 3);
  }
}
console.log('PASS: five navigation groups, all 11 preserved destinations, path-boundary matching and optional built-page checks.');
