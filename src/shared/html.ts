/**
 * Byte-exact port of Python's `html.escape(s, quote=True)`, which the bot used
 * for every interpolated value. Note the apostrophe becomes `&#x27;`, not
 * `&apos;` — most JavaScript helpers get that one wrong.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;")
}
