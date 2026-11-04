/**
 * Independent edition deployment guard.
 * Do not silently connect to the historical Rural Medicaid / NBH backend.
 * Validate the new Supabase hostname and project ID before creating a client.
 */
const LEGACY_PROJECT_IDS = new Set(['wewqlnghxffinngxolor']);

export interface IndependentBackendConfig {
  projectId: string;
  url: string;
  publishableKey: string;
}

export function validateIndependentBackend(config: IndependentBackendConfig): IndependentBackendConfig {
  const projectId = config.projectId?.trim();
  const url = config.url?.trim();
  const publishableKey = config.publishableKey?.trim();
  if (!projectId || !url || !publishableKey ||
      projectId === 'your-new-project-id' ||
      projectId === 'winged-wolf-not-provisioned' ||
      publishableKey === 'your-new-project-publishable-key') {
    throw new Error('Independent backend not configured. Provision a new Supabase project and set its environment values.');
  }
  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error('Independent backend URL is invalid.');
  }
  if (endpoint.protocol !== 'https:' ||
      endpoint.hostname !== `${projectId}.supabase.co` ||
      endpoint.pathname !== '/' ||
      endpoint.search !== '' ||
      endpoint.hash !== '' ||
      LEGACY_PROJECT_IDS.has(projectId)) {
    throw new Error('Independent backend must use its own HTTPS Supabase project, not the original project.');
  }
  return { projectId, url, publishableKey };
}
