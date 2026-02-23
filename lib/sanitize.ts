/**
 * Escape HTML special characters to prevent XSS when embedding
 * user-provided strings into HTML templates (emails, etc.).
 *
 * This escapes ALL HTML characters — it does not allow "safe" tags through.
 * Use for any user string embedded into an HTML context.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Strip HTML tags entirely from a string.
 * Use for fields that should never contain HTML (names, notes, etc.)
 * when you want clean text, not escaped HTML entities.
 */
export function stripHtml(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '');
}
