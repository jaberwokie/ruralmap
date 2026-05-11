/**
 * Subtle chrome chip indicating that the current pageview is rendered in
 * publication-safe mode (`?public=1`). Non-interactive, low-contrast, and
 * positioned to be visible in any screenshot of the operational environment
 * without competing with operational chrome.
 *
 * Reads as quiet governance metadata — not a warning or alert banner.
 *
 * Pure presentation. No state, no logic.
 */
import { usePublicSafeMode } from '@/hooks/usePublicSafeMode';

const PublicSafeBadge = () => {
  const { isPublicSafe } = usePublicSafeMode();
  if (!isPublicSafe) return null;

  return (
    <div
      aria-label="Publication-safe operational view"
      className="pointer-events-none fixed left-2 top-2 z-[1300] select-none rounded-sm border border-border/40 bg-background/70 px-1.5 py-px text-[9px] font-normal tracking-normal text-muted-foreground/80 backdrop-blur-sm"
    >
      Publication-safe operational view
    </div>
  );
};

export default PublicSafeBadge;
