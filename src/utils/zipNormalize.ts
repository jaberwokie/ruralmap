/**
 * Shared ZIP normalization helper.
 *
 * Rules:
 *  - "89701.0"      → "89701"   (Excel numeric artifact)
 *  - 89701          → "89701"
 *  - "89701"        → "89701"
 *  - "89701-1234"   → "89701-1234" (preserve ZIP+4)
 *  - "  89701  "    → "89701"
 *  - 4-digit numeric → zero-padded to 5 ("8970" → "08970")
 *  - blank/null/invalid → null
 */
export const normalizeZip = (value: unknown): string | null => {
  if (value == null) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const s = String(Math.trunc(value));
    if (s.length === 5) return s;
    if (s.length === 4) return `0${s}`;
    return null;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // ZIP+4 preserved
  const plus4 = trimmed.match(/^(\d{5})-(\d{4})$/);
  if (plus4) return `${plus4[1]}-${plus4[2]}`;

  // Numeric with possible decimal (e.g. "89701.0", "89701.00")
  const dec = trimmed.match(/^(\d+)\.\d+$/);
  if (dec) {
    const digits = dec[1];
    if (digits.length === 5) return digits;
    if (digits.length === 4) return `0${digits}`;
    return null;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 5) return digits;
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  if (digits.length === 4) return `0${digits}`;
  return null;
};
