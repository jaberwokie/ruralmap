import * as React from "react";

const TABLET_MIN = 768;
const TABLET_MAX = 1024; // exclusive — desktop starts at 1024

/**
 * Tablet breakpoint: 768px–1023px.
 * Below 768 → mobile (input-first flow). 1024+ → laptop/desktop split.
 */
export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(
      `(min-width: ${TABLET_MIN}px) and (max-width: ${TABLET_MAX - 1}px)`,
    );
    const onChange = () => {
      const w = window.innerWidth;
      setIsTablet(w >= TABLET_MIN && w < TABLET_MAX);
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isTablet;
}
