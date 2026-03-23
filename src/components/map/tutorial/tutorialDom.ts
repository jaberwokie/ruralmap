import type { TutorialAnchorContext } from '@/components/map/tutorial/tutorialLayout';

const isScrollable = (element: HTMLElement) => {
  const styles = window.getComputedStyle(element);
  return /(auto|scroll|overlay)/.test(styles.overflowY) && element.scrollHeight > element.clientHeight;
};

const isFullyVisibleInContainer = (element: HTMLElement, container: HTMLElement) => {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return elementRect.top >= containerRect.top + 8 && elementRect.bottom <= containerRect.bottom - 8;
};

const isFullyVisibleInViewport = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.top >= 8 && rect.bottom <= window.innerHeight - 8 && rect.left >= 8 && rect.right <= window.innerWidth - 8;
};

const getScrollableAncestors = (element: HTMLElement) => {
  const ancestors: HTMLElement[] = [];
  let parent = element.parentElement;

  while (parent) {
    if (isScrollable(parent)) ancestors.push(parent);
    parent = parent.parentElement;
  }

  return ancestors;
};

export const resolveTutorialElements = (selectors: string[]) =>
  selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)) as HTMLElement[])
    .filter((element) => element.offsetParent !== null);

export const getPrimaryTutorialElement = (selectors: string[]) => resolveTutorialElements(selectors)[0] ?? null;

export const getTutorialAnchorContext = (element: HTMLElement | null, selectors: string[]): TutorialAnchorContext => {
  if (element?.closest('[data-tutorial="sidebar"]')) return 'sidebar';
  if (element?.closest('[data-tutorial="details-panel"]')) return 'details';
  if (element?.closest('[data-tutorial="map-region"]')) return 'map';

  const selectorText = selectors.join(' ');

  if (/(search-bar|facility-filter|county-filter|section-core-map|toggle-provider-locations|sidebar)/.test(selectorText)) {
    return 'sidebar';
  }

  if (selectorText.includes('details-panel')) return 'details';
  if (selectorText.includes('map-region')) return 'map';

  return 'generic';
};

export const getTutorialFallbackElement = (selectors: string[]) => {
  const anchorContext = getTutorialAnchorContext(null, selectors);

  if (anchorContext === 'sidebar') {
    return document.querySelector('[data-tutorial="sidebar"]') as HTMLElement | null;
  }

  if (anchorContext === 'details') {
    return document.querySelector('[data-tutorial="details-panel"]') as HTMLElement | null;
  }

  if (anchorContext === 'map') {
    return document.querySelector('[data-tutorial="map-region"]') as HTMLElement | null;
  }

  return null;
};

export const scrollTutorialElementIntoView = (element: HTMLElement | null) => {
  if (!element) return false;

  const needsContainerScroll = getScrollableAncestors(element).some((ancestor) => !isFullyVisibleInContainer(element, ancestor));
  const needsViewportScroll = !isFullyVisibleInViewport(element);

  if (needsContainerScroll || needsViewportScroll) {
    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    return true;
  }

  return false;
};