#!/usr/bin/env node
/**
 * Release gate for the independent Winged Wolf edition.
 * Source checks are runnable in CI; --release additionally requires written
 * rights review and new deployment credentials. No production changes.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const problems = [];
const failIf = (condition, message) => { if (condition) problems.push(message); };
const forbiddenFiles = [
  '.env',
  'src/data/sshpCatchments.ts',
  'src/utils/providerClaimsMetrics.ts',
  'public/data/utilization/zip_member_demand.json',
  'public/data/utilization/county_gap_summary.json',
  'public/data/utilization/provider_util_flat.json',
  'public/data/utilization/tribal_provider_summary.json',
  'public/data/utilization/zip_provider_rollup.json',
];
for (const path of forbiddenFiles) {
  failIf(existsSync(resolve(root, path)), `Forbidden source or environment file remains: ${path}`);
}
const facilities = read('src/data/facilities.ts');
failIf(/\bvolume:\s*\d+\s*,\s*tier:\s*['"]tier1['"]/.test(facilities), 'Claims-derived provider tier/volume rows remain');
const originalProject = 'wewqlnghxffinngxolor';
const backendConfig = read('supabase/config.toml');
failIf(backendConfig.includes(originalProject), 'Original Supabase project configured');
const client = read('src/integrations/supabase/client.ts');
failIf(!client.includes('validateIndependentBackend('), 'Backend identity check missing');
const serviceHook = read('src/hooks/useRuralServiceData.ts');
failIf(serviceHook.includes('enrichedRuralServices'), 'Service hook still includes inherited operational enrichments');
const providerHook = read('src/hooks/useFacilityData.ts');
failIf(providerHook.includes('return enrichFacilities('), 'Provider hook still applies inherited operational enrichment');
const manifest = JSON.parse(read('docs/winged-wolf-provenance-manifest.json'));
failIf(!Array.isArray(manifest.sources) || manifest.sources.length === 0, 'Source rights manifest is missing');
if (process.argv.includes('--release')) {
  failIf(manifest.distributionAuthorized !== true || manifest.recordsReviewed !== true, 'Distribution and record-level rights have not been approved');
  for (const source of manifest.sources ?? []) {
    failIf(source.reviewStatus !== 'approved' || !source.sourceUrl || !source.rightsEvidence, `Missing release-approved provenance: ${source.id}`);
  }
  const project = process.env.VITE_SUPABASE_PROJECT_ID;
  const endpoint = process.env.VITE_SUPABASE_URL;
  failIf(!project || project === originalProject || !endpoint || !endpoint.startsWith(`https://${project}.supabase.co`), 'New independent backend environment is not confirmed');
}
if (problems.length) {
  for (const p of problems) console.error('BLOCKED:', p);
  process.exitCode = 1;
} else {
  console.log(process.argv.includes('--release') ? 'Release source gates passed (runtime QA still required)' : 'Independent source safety checks passed');
}
