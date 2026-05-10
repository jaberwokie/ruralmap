/**
 * Always-visible coverage disclaimer for PUBLIC_SAFE_MODE.
 *
 * Anchored at bottom-center of the operational environment so it appears in
 * any screenshot that includes the operational view. Non-interactive,
 * unobtrusive — purely an external-facing exposure-control note.
 */
import { usePublicSafeMode } from '@/hooks/usePublicSafeMode';

export const PublicSafeDisclaimer = () => {
  const { isPublicSafe } = usePublicSafeMode();
  if (!isPublicSafe) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-3 left-1/2 z-[1200] -translate-x-1/2 select-none rounded-md border border-border bg-background/90 px-3 py-1.5 text-[10px] leading-snug text-muted-foreground shadow-sm backdrop-blur-sm max-w-[90vw] text-center"
    >
      Publication-safe operational view. Reach reflects estimated travel-time from current field staff positions and is not a guarantee of full county coverage.
    </div>
  );
};

export default PublicSafeDisclaimer;
