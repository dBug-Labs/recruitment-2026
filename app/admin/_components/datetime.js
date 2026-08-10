/**
 * `<input type="datetime-local">` yields "2026-09-01T10:00" — no zone, no
 * seconds. Parsing that with `new Date()` reads it in the browser's local time,
 * which is what the admin actually meant, and toISOString() then pins it to UTC
 * for the API.
 */
export function toIsoOrEmpty(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Formats a Date/ISO string back into a `datetime-local` input value. */
export function toLocalInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
