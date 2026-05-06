/** Website normalization utilities used across detail subsections. */

/** Normalize a website string: trim, add https:// if missing scheme, then validate. */
export const normalizeWebsite = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try { new URL(url); return url; } catch { return null; }
};

export const isValidUrl = (str: string): boolean => normalizeWebsite(str) !== null;

/** Extract a readable hostname label from a URL string. */
export const websiteDisplayLabel = (url: string): string => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.length > 35 ? host.slice(0, 32) + '…' : host;
  } catch { return 'Website'; }
};
