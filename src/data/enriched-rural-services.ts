/**
 * Enriched rural services — applies operational metadata and classification.
 * Import this instead of raw ruralServices when operational context is needed.
 */

import { ruralServices as rawServices, type RuralService } from '@/data/rural-services';
import { enrichRuralServices } from '@/utils/operationalEnrichment';
import { classifyAllRuralServices } from '@/utils/operationalServiceClass';

export const enrichedRuralServices: RuralService[] = classifyAllRuralServices(enrichRuralServices(rawServices));
