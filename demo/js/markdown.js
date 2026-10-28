// A small Markdown renderer for the docs pages. It handles what the docs use: headings, paragraphs, bold, italic, inline
// code, links, fenced code blocks, bullet and numbered lists (nested), block quotes, tables and rules. Everything is
// HTML-escaped first, so a docs page can't inject markup. (GitHub renders the same files with its own renderer.)

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function slugifyHeading(text) {
  return String(text).toLowerCase().replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

/** Inline formatting. `rewriteLink(url)` can change link addresses (the docs use it to turn page.md into #/docs/page). */
export function renderInline(text, rewriteLink = (u) => u) {
  const pieces = String(text).split(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/);
  // split() with two capture groups gives [text, ticks, code, text, ticks, code, ...]
  let out = '';
  for (let i = 0; i < pieces.length; i += 3) {
    out += formatText(pieces[i], rewriteLink);
    if (i + 2 < pieces.length) out += `<code>${escapeHtml(pieces[i + 2].trim())}</code>`;
  }
  return out;
}

function formatText(text, rewriteLink) {
  let s = escapeHtml(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (m, label, url, title) => {
    const target = rewriteLink(url.replace(/&amp;/g, '&'));
    const external = /^https?:\/\//.test(target);
    return `<a href="${escapeHtml(target)}"${title ? ` title="${title}"` : ''}${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w])_([^_\s][^_]*?)_(?![\w])/g, '$1<em>$2</em>');
  return s;
}

function splitRow(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);
  // Split on pipes, except inside `code` and when written \|
  const cells = []; let cell = ''; let inCode = false;
  for (let k = 0; k < trimmed.length; k++) {
    const ch = trimmed[k];
    if (ch === '`') inCode = !inCode;
    if (ch === '\\' && trimmed[k + 1] === '|') { cell += '|'; k++; continue; }
    if (ch === '|' && !inCode) { cells.push(cell.trim()); cell = ''; continue; }
    cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

const BULLET = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

export function renderMarkdown(source, { rewriteLink = (u) => u } = {}) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const headings = [];
  const inline = (t) => renderInline(t, rewriteLink);
  let html = '';
  let i = 0;

  function parseList(indent) {
    const ordered = /\d/.test(BULLET.exec(lines[i])[2]);
    let out = ordered ? '<ol>' : '<ul>';
    while (i < lines.length) {
      const m = BULLET.exec(lines[i]);
      if (!m || m[1].length !== indent) break;
      let item = m[3];
      i++;
      let nested = '';
      while (i < lines.length) {
        if (lines[i].trim() === '') {
          // a blank line inside a list: the list goes on only if the next non-blank line is still indented
          let j = i; while (j < lines.length && lines[j].trim() === '') j++;
          if (j < lines.length && /^\s+\S/.test(lines[j]) && (BULLET.exec(lines[j]) ? BULLET.exec(lines[j])[1].length > indent : true) && lines[j].search(/\S/) > indent) { i = j; continue; }
          break;
        }
        const nm = BULLET.exec(lines[i]);
        if (nm && nm[1].length > indent) { nested += parseList(nm[1].length); continue; }
        if (nm && nm[1].length <= indent) break;
        if (lines[i].search(/\S/) > indent) { item += ' ' + lines[i].trim(); i++; continue; }
        break;
      }
      out += `<li>${inline(item)}${nested}</li>`;
    }
    return out + (ordered ? '</ol>' : '</ul>');
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }

    const fence = /^(\s*)(```+|~~~+)\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !new RegExp('^\\s*' + fence[2].replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*$').test(lines[i])) {
        body.push(lines[i].startsWith(fence[1]) ? lines[i].slice(fence[1].length) : lines[i]);
        i++;
      }
      i++;
      html += `<pre class="code"${fence[3] ? ` data-lang="${escapeHtml(fence[3])}"` : ''}><code>${escapeHtml(body.join('\n'))}</code></pre>`;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*?)\s*#*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const id = slugifyHeading(text);
      headings.push({ level, text: text.replace(/[`*_]/g, ''), id });
      html += `<h${level} id="${id}">${inline(text)}</h${level}>`;
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { html += '<hr>'; i++; continue; }

    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      html += `<blockquote>${renderMarkdown(quote.join('\n'), { rewriteLink }).html}</blockquote>`;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      let rows = '';
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
        rows += '<tr>' + splitRow(lines[i]).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
        i++;
      }
      html += `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
      continue;
    }

    if (BULLET.test(line)) { html += parseList(BULLET.exec(line)[1].length); continue; }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4})\s/.test(lines[i]) && !/^\s*(```|~~~)/.test(lines[i]) && !BULLET.test(lines[i]) && !/^\s*>/.test(lines[i])) {
      paragraph.push(lines[i].trim()); i++;
    }
    html += `<p>${inline(paragraph.join(' '))}</p>`;
  }
  return { html, headings };
}
