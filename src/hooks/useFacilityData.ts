import { useState, useCallback, useMemo, useEffect } from 'react';
import { Facility, defaultFacilities, auditFacilityClassifications, auditFacilityConfidence } from '@/data/facilities';
import { buildFacilityValidationIndex } from '@/utils/facilityValidation';
import { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';
import { enrichFacilities, auditOperationalCoverage } from '@/utils/operationalEnrichment';
import { ruralServices } from '@/data/rural-services';
import type { Filters } from '@/types/filters';

export interface UseFacilityDataReturn {
  facilities: Facility[];
  filteredFacilities: Facility[];
  addFacilities: (newFacilities: Facility[]) => void;
}

export const useFacilityData = (filters: Filters): UseFacilityDataReturn => {
  const [importedFacilities, setImportedFacilities] = useState<Facility[]>([]);

  const facilities = useMemo(
    () => [...defaultFacilities, ...importedFacilities],
    [importedFacilities],
  );

  const filteredFacilities = useMemo(() => {
    return facilities.filter(f => {
      if (!f.lat || !f.lng || isNaN(f.lat) || isNaN(f.lng)) return false;
      if (filters.types.size > 0) {
        const matchesPrimaryType = filters.types.has(f.type);
        const matchesBehavioralHealth = filters.types.has('behavioralHealth') && facilityOffersBehavioralHealth(f);
        if (!matchesPrimaryType && !matchesBehavioralHealth) return false;
      }
      if (filters.counties.size > 0 && !filters.counties.has(f.county)) return false;
      return true;
    });
  }, [facilities, filters]);

  const addFacilities = useCallback((newFacilities: Facility[]) => {
    setImportedFacilities(prev => [...prev, ...newFacilities]);
  }, []);

  // Dev-only audits
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    buildFacilityValidationIndex(facilities);
    console.info('[Facility Classification Audit]', auditFacilityClassifications(facilities));
    console.info('[Facility Confidence Audit]', auditFacilityConfidence(facilities));
  }, [facilities]);

  return { facilities, filteredFacilities, addFacilities };
};
