/**
 * Field response strain — stable re-export surface.
 * All logic remains in src/utils/fieldResponseStrain.ts.
 */
export {
  computeFieldResponseStrain,
  getCountyResponseClassification,
  getStrainRecommendation,
  getCapacityBoundaryLabel,
  STRAIN_TONE,
} from '@/utils/fieldResponseStrain';
export type {
  CountyResponseLevel,
  CountyResponseClassification,
  StrainCoverageState,
  FieldResponseStrain,
} from '@/utils/fieldResponseStrain';
