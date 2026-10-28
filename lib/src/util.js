// Small helpers shared by the rest of the library. Nothing here touches the DOM or Mermaid.

export function isNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
}

/** A checkbox-ish value ("1", "on", true, 1) as a boolean. */
export function truthy(value) {
  return value === true || value === 1 || value === '1' || value === 'on' || value === 'true';
}

export function cleanInt(value, min, max, fallback) {
  if (!isNumeric(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(Number(value))));
}

/** A #rrggbb colour (lower-cased), or the fallback. */
export function cleanColour(value, fallback) {
  return (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) ? value.toLowerCase() : fallback;
}

export function cleanEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/** An explicit order number, or '' for "none". */
export function cleanOrder(value) {
  return (isNumeric(value) && value !== '') ? Math.max(-100000, Math.min(100000, Math.trunc(Number(value)))) : '';
}

/** One line of plain text: tags removed, whitespace collapsed, trimmed and length-limited. */
export function plainLine(text, maxLength = 200) {
  const out = String(text ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(out).slice(0, maxLength).join('');
}

/** Whether a string is a real calendar date written YYYY-MM-DD. */
export function validDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof text === 'string' ? text : '');
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const DAY_MS = 86400000;

/** YYYY-MM-DD -> milliseconds at UTC midnight. */
export function dayToMs(ymd) { return Date.parse(ymd + 'T00:00:00Z'); }

/** milliseconds -> YYYY-MM-DD (UTC). */
export function msToDay(ms) { return new Date(ms).toISOString().slice(0, 10); }

/** Today as YYYY-MM-DD in the visitor's own time zone. */
export function todayLocal(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function clone(value) { return JSON.parse(JSON.stringify(value)); }
