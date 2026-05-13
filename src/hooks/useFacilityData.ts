import { useState, useCallback, useMemo, useEffect } from 'react';
import { Facility, defaultFacilities, auditFacilityClassifications, auditFacilityConfidence } from '@/data/facilities';
import { buildFacilityValidationIndex } from '@/utils/facilityValidation';
import { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';
import { enrichFacilities, auditOperationalCoverage, logVerifiedAccessSummary } from '@/utils/operationalEnrichment';
import { enrichedRuralServices } from '@/data/enriched-rural-services';
import { auditServiceClassification, getTaggingQueue, getQueueSummary, getDeferredSummary, getConfidenceSummary } from '@/utils/operationalServiceClass';
import {
  appendImportedFacilities,
  getImportedFacilities,
  subscribeToImportedFacilities,
} from '@/utils/importedFacilitiesStore';
import { listFacilitiesFromDb } from '@/utils/staticDataStore';
import type { Filters } from '@/types/filters';
import {
  matchesPsychiatryFilter, matchesVerifiedPsychiatry, matchesAcceptingPsych, matchesTelepsychiatry,
  matchesInpatientFilter, matchesVerifiedInpatient, matchesPsychiatricInpatient,
  matchesDetoxInpatient, matchesAcceptingAdmissions, matchesMedicaidInpatient,
} from '@/types/service-lines';

export interface UseFacilityDataReturn {
  facilities: Facility[];
  filteredFacilities: Facility[];
  addFacilities: (newFacilities: Facility[]) => void;
  dbLoaded: boolean;
}

export const useFacilityData = (filters: Filters): UseFacilityDataReturn => {
  const [importedFacilities, setImportedFacilities] = useState<Facility[]>(() => getImportedFacilities());
  const [dbFacilities, setDbFacilities] = useState<Facility[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Stay in sync with imports performed from any other route (e.g. /admin).
  useEffect(() => subscribeToImportedFacilities(() => setImportedFacilities(getImportedFacilities())), []);

  useEffect(() => {
    listFacilitiesFromDb().then((rows) => {
      if (rows.length > 0) setDbFacilities(rows);
      setDbLoaded(true);
    });
  }, []);

  const facilities = useMemo(
    () => {
      const base = dbFacilities.length > 0 ? dbFacilities : defaultFacilities;
      return enrichFacilities([...base, ...importedFacilities]);
    },
    [dbFacilities, importedFacilities],
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

      // ── Service-line filters ──
      if (filters.psychiatry && !matchesPsychiatryFilter(f.psychiatric)) return false;
      if (filters.verifiedPsychiatryOnly && !matchesVerifiedPsychiatry(f.psychiatric)) return false;
      if (filters.acceptingPsychPatients && !matchesAcceptingPsych(f.psychiatric)) return false;
      if (filters.telepsychiatry && !matchesTelepsychiatry(f.psychiatric)) return false;
      if (filters.inpatientServices && !matchesInpatientFilter(f.inpatient)) return false;
      if (filters.verifiedInpatientOnly && !matchesVerifiedInpatient(f.inpatient)) return false;
      if (filters.psychiatricInpatient && !matchesPsychiatricInpatient(f.inpatient)) return false;
      if (filters.detoxInpatient && !matchesDetoxInpatient(f.inpatient)) return false;
      if (filters.acceptingAdmissions && !matchesAcceptingAdmissions(f.inpatient)) return false;
      if (filters.medicaidInpatient && !matchesMedicaidInpatient(f.inpatient)) return false;

      return true;
    });
  }, [facilities, filters]);

  const addFacilities = useCallback((newFacilities: Facility[]) => {
    const next = appendImportedFacilities(newFacilities);
    setImportedFacilities(next);
  }, []);

  // Dev-only audits
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    buildFacilityValidationIndex(facilities);
    console.info('[Facility Classification Audit]', auditFacilityClassifications(facilities));
    console.info('[Facility Confidence Audit]', auditFacilityConfidence(facilities));
    console.info('[Operational Coverage Audit]', auditOperationalCoverage(facilities, enrichedRuralServices));
    logVerifiedAccessSummary();
    const classAudit = auditServiceClassification(enrichedRuralServices);
    console.info('[Service Class Audit]');
    console.table(classAudit.rows);
    const queue = getTaggingQueue(enrichedRuralServices);
    const needsVerification = queue.filter(q => q.verificationStatus === 'needs_verification');
    console.info(`[Tagging Queue] ${queue.length} priority services, ${needsVerification.length} need verification`);
    console.info('[Queue Summary]');
    console.table(getQueueSummary(queue));
    const confidenceSummary = getConfidenceSummary(queue);
    if (confidenceSummary.length > 0) {
      console.info('[Verification Confidence]');
      console.table(confidenceSummary);
    }
    const deferredSummary = getDeferredSummary(queue);
    if (deferredSummary.length > 0) {
      console.info('[Deferred Breakdown]');
      console.table(deferredSummary);
    }
    if (needsVerification.length > 0) {
      console.info('[Needs Verification]');
      console.table(needsVerification);
    }
  }, [facilities]);

  return { facilities, filteredFacilities, addFacilities };
};
