/**
 * Subtle chrome chip indicating that the current pageview is rendered in
 * publication-safe mode (`?public=1`). Non-interactive, low-contrast, and
 * positioned to be visible in any screenshot of the operational environment
 * without competing with operational chrome.
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
      className="pointer-events-none fixed left-2 top-2 z-[1300] select-none rounded-full border border-border bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur-sm"
    >
      Publication-safe operational view
    </div>
  );
};

export default PublicSafeBadge;
