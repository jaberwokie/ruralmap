import { useState, useEffect } from 'react';
import { loadBroadbandData } from '@/data/broadband-coverage';

export interface UseBroadbandDataReturn {
  broadbandReady: boolean;
}

export const useBroadbandData = (): UseBroadbandDataReturn => {
  const [broadbandReady, setBroadbandReady] = useState(false);

  useEffect(() => {
    loadBroadbandData().then((ok) => setBroadbandReady(ok));
  }, []);

  return { broadbandReady };
};
