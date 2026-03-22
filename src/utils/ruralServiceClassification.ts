import type { RuralService, RuralServiceCategory } from '@/data/rural-services';

export const BEHAVIORAL_HEALTH_SERVICE_CATEGORIES = new Set<RuralServiceCategory>([
  'Mental Health',
  'Substance Use',
]);

export const isBehavioralHealthService = (service: Pick<RuralService, 'category'>) =>
  BEHAVIORAL_HEALTH_SERVICE_CATEGORIES.has(service.category);

export const isCommunitySupportService = (service: Pick<RuralService, 'category'>) =>
  !isBehavioralHealthService(service);