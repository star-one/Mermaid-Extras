import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../demo/js/markdown.js';
import { rewriteDocLink, DOC_PAGES } from '../demo/js/views/docs-page.js';
import { readFileSync, existsSync } from 'node:fs';

const html = (src, opts) => renderMarkdown(src, opts).html;

test('headings get ids and are reported', () => {
  const { html: out, headings } = renderMarkdown('# One\n\n## Two words\n');
  assert.match(out, /<h1 id="one">One<\/h1>/);
  assert.deepEqual(headings.map((h) => [h.level, h.id]), [[1, 'one'], [2, 'two-words']]);
});

test('inline formatting, and HTML in the text is escaped', () => {
  assert.equal(html('a **b** *c* `d <e>` <script>'), '<p>a <strong>b</strong> <em>c</em> <code>d &lt;e&gt;</code> &lt;script&gt;</p>');
  assert.ok(!html('[x](javascript:alert(1))').includes('<script'));
});

test('links: external ones open in a new tab, doc links are rewritten', () => {
  const out = html('[web](https://example.org) and [page](getting-started.md)', { rewriteLink: rewriteDocLink });
  assert.match(out, /href="https:\/\/example.org" target="_blank" rel="noopener"/);
  assert.match(out, /href="#\/docs\/getting-started"/);
});

test('code blocks are kept literally', () => {
  const out = html('```js\nconst a = "<b>"; // **not bold**\n```');
  assert.match(out, /<pre class="code" data-lang="js"><code>const a = &quot;&lt;b&gt;&quot;; \/\/ \*\*not bold\*\*<\/code><\/pre>/);
});

test('lists, nested lists and numbered lists', () => {
  assert.equal(html('- a\n- b\n  - c\n- d'), '<ul><li>a</li><li>b<ul><li>c</li></ul></li><li>d</li></ul>');
  assert.equal(html('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>');
});

test('tables, including a pipe inside code', () => {
  const out = html('| a | b |\n|---|---|\n| `x|y` | 2 |');
  assert.match(out, /<th>a<\/th><th>b<\/th>/);
  assert.match(out, /<td><code>x\|y<\/code><\/td><td>2<\/td>/);
});

test('block quotes and rules', () => {
  assert.match(html('> note\n> more'), /<blockquote><p>note more<\/p><\/blockquote>/);
  assert.equal(html('---'), '<hr>');
});

test('snake_case words and arithmetic are not turned into emphasis', () => {
  assert.equal(html('snake_case_word and 2 * 3 * 4'), '<p>snake_case_word and 2 * 3 * 4</p>');
});

test('every docs page exists, renders, and only links to pages that exist', () => {
  for (const [slug] of DOC_PAGES) {
    const path = new URL(`../docs/${slug}.md`, import.meta.url);
    assert.ok(existsSync(path), `docs/${slug}.md is missing`);
    const text = readFileSync(path, 'utf8');
    const { html: out, headings } = renderMarkdown(text, { rewriteLink: rewriteDocLink });
    assert.ok(out.length > 200, slug);
    assert.ok(headings.some((h) => h.level === 1), `${slug} has a title`);
    for (const match of text.matchAll(/\]\(((?:\.\/)?[a-z-]+\.md)(?:#[^)]*)?\)/g)) {
      const target = match[1].replace(/^\.\//, '').replace(/\.md$/, '');
      assert.ok(DOC_PAGES.some(([id]) => id === target), `${slug}.md links to a page that doesn't exist: ${match[1]}`);
    }
    assert.ok(!/```[\s\S]*```/.test(out.replace(/<pre[\s\S]*?<\/pre>/g, '')), `${slug} has an unclosed code block`);
  }
});
