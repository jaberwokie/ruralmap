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

/**
 * Optional callback context — when provided, allows utilization sub-sections
 * to navigate the details panel to a provider entity by name. Returns true
 * when a matching facility was found and selected; false otherwise.
 */
export type UtilizationProviderClickHandler = (providerName: string) => boolean;

export const UtilizationProviderClickContext = createContext<UtilizationProviderClickHandler | null>(null);

export const useUtilizationProviderClick = (): UtilizationProviderClickHandler | null =>
  useContext(UtilizationProviderClickContext);
