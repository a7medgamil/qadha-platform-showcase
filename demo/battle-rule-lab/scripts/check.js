import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createFixture, assertState } from '../src/engine.js';
import { replayScenario } from '../src/scenario.js';

if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node 22+ is required.');
const root = new URL('../', import.meta.url);
const files = await readdir(root, { recursive: true });
const sources = files.filter((file) => file.endsWith('.js'));
for (const file of sources) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(file.replaceAll('\\', '/'), root))], { encoding: 'utf8' });
  if (result.status !== 0 || result.error) throw new Error(`Syntax check failed: ${file}\n${result.stderr || result.error}`);
}
const html = await readFile(new URL('public/index.html', root), 'utf8');
const app = await readFile(new URL('public/app.js', root), 'utf8');
const css = await readFile(new URL('public/styles.css', root), 'utf8');
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
for (const match of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]), `Missing DOM ID: ${match[1]}`);
assert.equal((html.match(/Independent synthetic battle-rules lab — not QADHA production\./g) ?? []).length, 2, 'Top and bottom boundary labels');
assert.match(html, /aria-live="polite"/); assert.match(html, /<html lang="en">/);
assert.match(css, /:focus-visible/); assert.match(css, /prefers-reduced-motion/);
assert.ok(!pkg.dependencies && !pkg.devDependencies, 'Dependency-free runtime and tests');
assert.ok(!/\b(?:localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|Math\.random)\b/.test(app), 'No persistence, API calls or randomness in UI');
assert.ok(!/(?:src|href)="https?:\/\//.test(html), 'No remote page assets');
assertState(createFixture()); assertState(replayScenario());
console.log(`PASS: Node ${process.versions.node}; ${sources.length} JavaScript syntax checks; DOM wiring, boundary labels, accessibility hooks, offline constraints and deterministic replay invariants.`);
