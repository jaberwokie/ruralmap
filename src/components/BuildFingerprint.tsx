/**
 * Public, non-interactive build fingerprint.
 *
 * Rendered for ALL viewers (not gated by admin role) so that preview,
 * published `.lovable.app`, and the custom domain can be visually compared
 * to confirm they are running the same bundle. Intentionally tiny and
 * low-contrast so it does not interfere with the operational UI.
 *
 * Reads `__APP_BUILD_ID__` (defined in vite.config.ts), with `__APP_VERSION__`
 * / `__APP_BUILD_TIME__` as supplemental context. The build id changes on
 * every build, so a mismatch between two URLs proves they are on different
 * deployments without needing dev tools or admin access.
 */

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
};

export const BuildFingerprint = () => {
  const buildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '';
  const buildTime = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : '';
  const dateStr = buildTime ? formatDate(buildTime) : '';
  // Short, parse-safe id segment (8 chars) — enough to disambiguate builds
  // without dominating the corner.
  const shortId = buildId ? buildId.slice(0, 12) : 'dev';
  const label = dateStr ? `build ${shortId} • ${dateStr}` : `build ${shortId}`;

  return (
    <div
      aria-hidden="true"
      data-build-id={buildId}
      data-build-time={buildTime}
      className="pointer-events-none fixed bottom-1 left-1 z-[9999] hidden select-none rounded bg-background/60 px-1.5 py-0.5 text-[9px] font-mono leading-none tracking-tight text-muted-foreground/70 tabular-nums md:block"
    >
      {label}
    </div>
  );
};

export default BuildFingerprint;
