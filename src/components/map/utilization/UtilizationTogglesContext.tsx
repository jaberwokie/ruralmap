import { createContext, useContext } from 'react';

export interface UtilizationToggles {
  countyUtilization: boolean;
  providerUtilizationReach: boolean;
  tribalUtilization: boolean;
  /** Tribal Nations layer must be on for tribal utilization to render. */
  tribalNations: boolean;
}

const DEFAULT: UtilizationToggles = {
  countyUtilization: false,
  providerUtilizationReach: false,
  tribalUtilization: false,
  tribalNations: false,
};

export const UtilizationTogglesContext = createContext<UtilizationToggles>(DEFAULT);

export const useUtilizationToggles = (): UtilizationToggles => useContext(UtilizationTogglesContext);
