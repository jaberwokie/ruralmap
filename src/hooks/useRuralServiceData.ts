import { useState, useEffect } from 'react';
import { subscribeRuralServicesChanged } from '@/utils/verifiedRecordsBus';
import { RuralService } from '@/data/rural-services';
import { ruralServices as rawRuralServices } from '@/data/rural-services';
import { listRuralServicesFromDb } from '@/utils/staticDataStore';
import { allowLegacyStaticPreview } from '@/lib/independentResourcePolicy';

export const useRuralServiceData = () => {
  const [dbServices, setDbServices] = useState<RuralService[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    listRuralServicesFromDb().then((rows) => {
      if (rows.length > 0) setDbServices(rows);
      setDbLoaded(true);
    });
  }, []);

  useEffect(() => {
    return subscribeRuralServicesChanged(() => {
      listRuralServicesFromDb().then((rows) => {
        if (rows.length > 0) setDbServices(rows);
      });
    });
  }, []);

  // Keep published resource locations, not inherited payer/staffing enrichments.
  const fallback = allowLegacyStaticPreview(import.meta.env.DEV, import.meta.env.VITE_ENABLE_UNREVIEWED_DATA_PREVIEW)
    ? rawRuralServices : [];
  const ruralServices = (dbServices.length > 0 ? dbServices : fallback).map(({ operational, operationalServiceClass, ...location }) => location);

  return { ruralServices, dbLoaded };
};
