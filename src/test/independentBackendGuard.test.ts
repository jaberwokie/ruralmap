import { describe, expect, it } from 'vitest';
import { validateIndependentBackend } from '@/integrations/supabase/independentBackendGuard';

const valid = {
  projectId: 'new-rural-access-project',
  url: 'https://new-rural-access-project.supabase.co/',
  publishableKey: 'public-example-not-secret',
};

describe('independent backend isolation', () => {
  it('accepts correctly paired fresh project values', () => {
    expect(validateIndependentBackend(valid)).toEqual(valid);
  });
  it('rejects legacy backend even when URL and project ID agree', () => {
    expect(() => validateIndependentBackend({
      ...valid,
      projectId: 'wewqlnghxffinngxolor',
      url: 'https://wewqlnghxffinngxolor.supabase.co/',
    })).toThrow(/original project/i);
  });
  it('rejects mismatched host, missing config or plain HTTP', () => {
    expect(() => validateIndependentBackend({ ...valid, url: 'https://somewhere-else.supabase.co/' })).toThrow();
    expect(() => validateIndependentBackend({ ...valid, publishableKey: '' })).toThrow();
    expect(() => validateIndependentBackend({ ...valid, url: 'http://new-rural-access-project.supabase.co/' })).toThrow();
  });
});
