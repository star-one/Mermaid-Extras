// Architecture checks: the library stands alone, the demo uses only its public entry point, every import resolves,
// and the documentation only mentions things that exist.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as library from '../lib/mermaid-extras.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? (name === 'node_modules' ? [] : walk(path)) : [path];
});
const files = (dir, ext) => walk(join(root, dir)).filter((f) => f.endsWith(ext));
const importsOf = (text) => [...text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)].map((m) => m[1] || m[2]);

test('the library stands alone: it imports only its own files, and no Mermaid', () => {
  for (const file of files('lib', '.js')) {
    for (const spec of importsOf(readFileSync(file, 'utf8'))) {
      assert.ok(spec.startsWith('.'), `${relative(root, file)} imports "${spec}": the library has no dependencies (Mermaid is passed in)`);
      const target = resolve(dirname(file), spec);
      assert.ok(target.startsWith(join(root, 'lib')), `${relative(root, file)} reaches outside lib/: ${spec}`);
      assert.ok(existsSync(target), `${relative(root, file)} imports ${spec}, which doesn't exist`);
    }
  }
});

test('the library does not use Node-only features or globals that a browser lacks', () => {
  for (const file of files('lib', '.js')) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/\brequire\(|from ['"]node:|process\.env|__dirname/.test(text), `${relative(root, file)} uses a Node-only feature`);
  }
});

test('the demo reaches the library only through its public entry point', () => {
  for (const file of files('demo', '.js')) {
    for (const spec of importsOf(readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.')) continue;
      const target = resolve(dirname(file), spec);
      assert.ok(existsSync(target), `${relative(root, file)} imports ${spec}, which doesn't exist`);
      if (target.startsWith(join(root, 'lib'))) assert.equal(target, join(root, 'lib', 'mermaid-extras.js'), `${relative(root, file)} reaches into the library's internals: ${spec}`);
    }
  }
});

test('the demo page loads files that exist', () => {
  const html = readFileSync(join(root, 'demo/index.html'), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) {
    if (match[1].startsWith('data')) continue;
    assert.ok(existsSync(resolve(root, 'demo', match[1])), `demo/index.html refers to ${match[1]}, which doesn't exist`);
  }
});

test('the demo does not talk to anything but Mermaid and the icon packs', () => {
  for (const file of [...files('demo', '.js'), ...files('lib', '.js')]) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
      const url = match[0];
      if (/jsdelivr|github\.com|mermaid\.js\.org|w3\.org|your-name/.test(url)) continue;
      assert.fail(`${relative(root, file)} mentions ${url}`);
    }
  }
});

test('every name the documentation imports from the library is really exported', () => {
  for (const file of files('docs', '.md').concat([join(root, 'README.md')])) {
    const text = readFileSync(file, 'utf8');
    for (const block of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.\/lib\/mermaid-extras\.js|mermaid-extras)'/g)) {
      for (const name of block[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        assert.ok(name in library, `${relative(root, file)} imports { ${name} }, which the library does not export`);
      }
    }
  }
});

test('every ChartView method and option the docs describe exists', async () => {
  const { ChartView } = library;
  const proto = Object.getOwnPropertyNames(ChartView.prototype);
  for (const name of ['render', 'on', 'off', 'timelineShorter', 'timelineLonger', 'timelineDefault', 'timelineShowAll', 'getSVG', 'exportSVG', 'getPNG', 'exportPNG', 'getCSV', 'exportCSV', 'destroy', 'pinTitles']) {
    assert.ok(proto.includes(name), `ChartView.${name} is documented but missing`);
  }
  const source = readFileSync(join(root, 'lib/src/view/chart-view.js'), 'utf8');
  for (const option of ['mermaid', 'storage', 'securityLevel', 'mermaidConfig', 'mindmapLayout', 'iconPacks', 'ganttTimeline', 'interactive', 'minZoom', 'maxZoom', 'zoomStep', 'exportTitle', 'fontFamily']) {
    assert.ok(source.includes(option), `the ${option} option is documented but not in the code`);
  }
});

test('the package manifest points at real files', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.ok(existsSync(join(root, pkg.main)));
  for (const target of Object.values(pkg.exports)) assert.ok(existsSync(join(root, target)), target);
  for (const entry of pkg.files) assert.ok(existsSync(join(root, entry)), entry);
  for (const script of Object.values(pkg.scripts)) for (const m of script.matchAll(/node (\S+\.mjs)/g)) assert.ok(existsSync(join(root, m[1])), m[1]);
});
