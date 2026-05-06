import { useCallback, useState } from 'react';

/** Hook for independent multi-open section state */
export const useAccordion = (defaultSection: string | string[]) => {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(Array.isArray(defaultSection) ? defaultSection : [defaultSection])
  );
  const toggle = useCallback((section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);
  const isOpen = useCallback((section: string) => openSections.has(section), [openSections]);
  return { isOpen, toggle };
};
