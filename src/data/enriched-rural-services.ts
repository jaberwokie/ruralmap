/**
 * Enriched rural services — applies operational metadata from the central source.
 * Import this instead of raw ruralServices when operational context is needed.
 */

import { ruralServices as rawServices, type RuralService } from '@/data/rural-services';
import { enrichRuralServices } from '@/utils/operationalEnrichment';

export const enrichedRuralServices: RuralService[] = enrichRuralServices(rawServices);
