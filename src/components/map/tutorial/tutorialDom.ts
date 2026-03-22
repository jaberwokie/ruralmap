const isScrollable = (element: HTMLElement) => {
  const styles = window.getComputedStyle(element);
  return /(auto|scroll|overlay)/.test(styles.overflowY) && element.scrollHeight > element.clientHeight;
};

const isFullyVisibleInContainer = (element: HTMLElement, container: HTMLElement) => {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return elementRect.top >= containerRect.top + 8 && elementRect.bottom <= containerRect.bottom - 8;
};

export const resolveTutorialElements = (selectors: string[]) =>
  selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)) as HTMLElement[])
    .filter((element) => element.offsetParent !== null);

export const getPrimaryTutorialElement = (selectors: string[]) => resolveTutorialElements(selectors)[0] ?? null;

export const scrollTutorialElementIntoView = (element: HTMLElement | null) => {
  if (!element) return false;

  let parent = element.parentElement;
  let scrolled = false;

  while (parent) {
    if (isScrollable(parent) && !isFullyVisibleInContainer(element, parent)) {
      element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      scrolled = true;
      break;
    }
    parent = parent.parentElement;
  }

  return scrolled;
};