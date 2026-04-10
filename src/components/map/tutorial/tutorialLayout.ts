export interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export type TutorialAnchorContext = 'sidebar' | 'map' | 'details' | 'generic';

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface CardLayout {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: TutorialPlacement;
}

export const HIGHLIGHT_PADDING = 6;
export const VIEWPORT_PADDING = 20;
export const CARD_MAX_WIDTH = 420;
export const CARD_MIN_WIDTH = 280;
export const CARD_MAX_HEIGHT = 420;
export const GAP = 18;
export const FALLBACK_CARD_HEIGHT = 300;

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const getViewportSize = (): ViewportSize => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

export const getHighlightRect = (elements: HTMLElement[]): HighlightRect | null => {
  const visibleRects = elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);

  if (visibleRects.length === 0) return null;

  const bounds = visibleRects.reduce(
    (acc, rect) => ({
      top: Math.min(acc.top, rect.top),
      left: Math.min(acc.left, rect.left),
      right: Math.max(acc.right, rect.right),
      bottom: Math.max(acc.bottom, rect.bottom),
    }),
    {
      top: visibleRects[0].top,
      left: visibleRects[0].left,
      right: visibleRects[0].right,
      bottom: visibleRects[0].bottom,
    },
  );

  return {
    top: clamp(bounds.top - HIGHLIGHT_PADDING, 8, Math.max(window.innerHeight - 24, 8)),
    left: clamp(bounds.left - HIGHLIGHT_PADDING, 8, Math.max(window.innerWidth - 24, 8)),
    width: clamp(bounds.right - bounds.left + HIGHLIGHT_PADDING * 2, 96, Math.max(window.innerWidth - 16, 96)),
    height: clamp(bounds.bottom - bounds.top + HIGHLIGHT_PADDING * 2, 48, Math.max(window.innerHeight - 16, 48)),
  };
};

export const getCardLayout = (
  viewport: ViewportSize,
  highlightRect: HighlightRect | null,
  measuredHeight: number,
  anchorContext: TutorialAnchorContext = 'generic',
  fallbackRect: HighlightRect | null = null,
): CardLayout => {
  const width = Math.min(CARD_MAX_WIDTH, Math.max(CARD_MIN_WIDTH, viewport.width - VIEWPORT_PADDING * 2));
  const maxHeight = Math.min(CARD_MAX_HEIGHT, viewport.height - VIEWPORT_PADDING * 2);
  const cardHeight = Math.min(Math.max(measuredHeight, FALLBACK_CARD_HEIGHT), maxHeight);
  const centeredLeft = clamp((viewport.width - width) / 2, VIEWPORT_PADDING, Math.max(viewport.width - width - VIEWPORT_PADDING, VIEWPORT_PADDING));
  const centeredTop = clamp((viewport.height - cardHeight) / 2, VIEWPORT_PADDING, Math.max(viewport.height - cardHeight - VIEWPORT_PADDING, VIEWPORT_PADDING));
  const anchorRect = highlightRect ?? fallbackRect;

  if (!anchorRect) {
    return {
      top: centeredTop,
      left: centeredLeft,
      width,
      maxHeight,
      placement: 'center',
    };
  }

  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;
  const spaceAbove = anchorRect.top - VIEWPORT_PADDING;
  const spaceBelow = viewport.height - (anchorRect.top + anchorRect.height) - VIEWPORT_PADDING;
  const spaceLeft = anchorRect.left - VIEWPORT_PADDING;
  const spaceRight = viewport.width - (anchorRect.left + anchorRect.width) - VIEWPORT_PADDING;

  const placeTop = () => ({
    top: clamp(anchorRect.top - cardHeight - GAP, VIEWPORT_PADDING, Math.max(viewport.height - cardHeight - VIEWPORT_PADDING, VIEWPORT_PADDING)),
    left: clamp(anchorCenterX - width / 2, VIEWPORT_PADDING, Math.max(viewport.width - width - VIEWPORT_PADDING, VIEWPORT_PADDING)),
    width,
    maxHeight,
    placement: 'top' as const,
  });

  const placeBottom = () => ({
    top: clamp(anchorRect.top + anchorRect.height + GAP, VIEWPORT_PADDING, Math.max(viewport.height - cardHeight - VIEWPORT_PADDING, VIEWPORT_PADDING)),
    left: clamp(anchorCenterX - width / 2, VIEWPORT_PADDING, Math.max(viewport.width - width - VIEWPORT_PADDING, VIEWPORT_PADDING)),
    width,
    maxHeight,
    placement: 'bottom' as const,
  });

  const placeLeft = () => ({
    top: clamp(anchorCenterY - cardHeight / 2, VIEWPORT_PADDING, Math.max(viewport.height - cardHeight - VIEWPORT_PADDING, VIEWPORT_PADDING)),
    left: clamp(anchorRect.left - width - GAP, VIEWPORT_PADDING, Math.max(viewport.width - width - VIEWPORT_PADDING, VIEWPORT_PADDING)),
    width,
    maxHeight,
    placement: 'left' as const,
  });

  const placeRight = () => ({
    top: clamp(anchorCenterY - cardHeight / 2, VIEWPORT_PADDING, Math.max(viewport.height - cardHeight - VIEWPORT_PADDING, VIEWPORT_PADDING)),
    left: clamp(anchorRect.left + anchorRect.width + GAP, VIEWPORT_PADDING, Math.max(viewport.width - width - VIEWPORT_PADDING, VIEWPORT_PADDING)),
    width,
    maxHeight,
    placement: 'right' as const,
  });

  if (anchorContext === 'sidebar') {
    if (spaceRight >= width + GAP) return placeRight();
    if (spaceBelow >= cardHeight + GAP) return placeBottom();
    if (spaceAbove >= cardHeight + GAP) return placeTop();
    if (spaceLeft >= width + GAP) return placeLeft();
    if (spaceRight >= GAP) return placeRight();
    if (spaceBelow >= GAP) return placeBottom();
    if (spaceAbove >= GAP) return placeTop();
    return placeLeft();
  }

  if (anchorContext === 'details') {
    if (spaceLeft >= width + GAP) return placeLeft();
    if (spaceBelow >= cardHeight + GAP) return placeBottom();
    if (spaceAbove >= cardHeight + GAP) return placeTop();
    if (spaceRight >= width + GAP) return placeRight();
    if (spaceLeft >= GAP) return placeLeft();
    if (spaceBelow >= GAP) return placeBottom();
    return placeTop();
  }

  if (anchorCenterX < viewport.width * 0.38 && spaceRight >= width + GAP) return placeRight();
  if (anchorCenterX > viewport.width * 0.62 && spaceLeft >= width + GAP) return placeLeft();
  if (spaceBelow >= cardHeight + GAP) return placeBottom();
  if (spaceAbove >= cardHeight + GAP) return placeTop();
  if (spaceRight >= width + GAP) return placeRight();
  if (spaceLeft >= width + GAP) return placeLeft();

  return placeBottom();
};

export const getArrowStyle = (layout: CardLayout, highlightRect: HighlightRect | null) => {
  if (!highlightRect || layout.placement === 'center') return null;

  const anchorCenterX = highlightRect.left + highlightRect.width / 2;
  const anchorCenterY = highlightRect.top + highlightRect.height / 2;
  const diamondSize = 12;

  if (layout.placement === 'top' || layout.placement === 'bottom') {
    return {
      left: clamp(anchorCenterX - layout.left - diamondSize / 2, 18, layout.width - 18 - diamondSize),
      top: layout.placement === 'bottom' ? -diamondSize / 2 : undefined,
      bottom: layout.placement === 'top' ? -diamondSize / 2 : undefined,
    };
  }

  return {
    top: clamp(anchorCenterY - layout.top - diamondSize / 2, 18, layout.maxHeight - 18 - diamondSize),
    left: layout.placement === 'right' ? -diamondSize / 2 : undefined,
    right: layout.placement === 'left' ? -diamondSize / 2 : undefined,
  };
};