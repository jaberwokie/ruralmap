import { useState, useEffect } from 'react';
import { subscribeRuralServicesChanged } from '@/utils/verifiedRecordsBus';
import { RuralService } from '@/data/rural-services';
import { enrichedRuralServices } from '@/data/enriched-rural-services';
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

  const ruralServices = dbServices.length > 0 ? dbServices : enrichedRuralServices;

  return { ruralServices, dbLoaded };
};
