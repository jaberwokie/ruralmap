/**
 * Display-only capitalization formatter.
 * Never mutates source data — used at render time only.
 */

const ACRONYMS = new Set(['ED', 'CAH', 'NV', 'NPI', 'BH', 'IHS', 'US', 'FTE', 'NRHP', 'DPBH', 'LTE', 'ICU', 'ER']);

const BOOL_MAP: Record<string, string> = { yes: 'Yes', no: 'No', true: 'Yes', false: 'No' };

/**
 * Title-case a single word, preserving known acronyms.
 */
const titleWord = (w: string): string => {
  const upper = w.toUpperCase();
  if (ACRONYMS.has(upper)) return upper;
  if (w.length === 0) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
};

/**
 * Format a generic display value for proper capitalization.
 * - Trims whitespace
 * - Maps boolean-like "yes"/"no" to "Yes"/"No"
 * - Preserves acronyms
 * - Title-cases generic strings including parenthetical content
 */
export function formatDisplayValue(value: string | number | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);

  const trimmed = value.trim();
  if (!trimmed) return '';

  // Boolean-like exact matches
  const lower = trimmed.toLowerCase();
  if (BOOL_MAP[lower] !== undefined) return BOOL_MAP[lower];

  // If already looks like a date (YYYY-MM-DD or similar), return as-is
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed;

  // If it's a URL or path-like string, return as-is
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) return trimmed;

  // Title-case: split on spaces, handle parentheses
  return trimmed
    .split(/(\s+)/)
    .map(segment => {
      if (/^\s+$/.test(segment)) return segment;
      // Handle parenthetical: "(word)" -> "(Word)"
      const parenMatch = segment.match(/^(\(?)([^)]*?)(\)?)$/);
      if (parenMatch) {
        const [, open, inner, close] = parenMatch;
        // Process inner words separated by spaces (shouldn't happen after split, but handle hyphens etc.)
        const formatted = inner
          .split(/(-)/g)
          .map(part => (part === '-' ? part : titleWord(part)))
          .join('');
        return `${open}${formatted}${close}`;
      }
      return titleWord(segment);
    })
    .join('');
}

/**
 * Format a tag/chip label for proper title case with acronym preservation.
 * Identical logic to formatDisplayValue but named for clarity.
 */
export const formatTagLabel = formatDisplayValue;
