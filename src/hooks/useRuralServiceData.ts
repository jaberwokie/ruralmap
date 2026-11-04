import { useState, useEffect } from 'react';
import { subscribeRuralServicesChanged } from '@/utils/verifiedRecordsBus';
import { RuralService } from '@/data/rural-services';
import { ruralServices as rawRuralServices } from '@/data/rural-services';
import { listRuralServicesFromDb } from '@/utils/staticDataStore';

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
  const ruralServices = (dbServices.length > 0 ? dbServices : rawRuralServices).map(({ operational, operationalServiceClass, ...location }) => location);

  return { ruralServices, dbLoaded };
};
