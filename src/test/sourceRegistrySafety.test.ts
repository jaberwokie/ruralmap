/**
 * Guards for the Source Registry surface:
 *  - no secret values are stored or rendered through it
 *  - Public Safe Mode and non-backend roles cannot reach it
 *  - the registry is not wired into live map / Decision Assist behavior
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { EDITABLE_FIELDS } from '@/pages/AdminDataSources';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
const page = read('src/pages/AdminDataSources.tsx');
const migration = read(
  'supabase/migrations/20260821182035_6b3ca517-ae08-4f08-b145-f82a63b4ffb6.sql',
);

describe('Source Registry — secret safety', () => {
  it('never exposes an editable field that could hold a secret value', () => {
    const banned = /(secret|api_key|apikey|token|password|credential_value|key_value)/i;
    for (const field of EDITABLE_FIELDS) {
      expect(banned.test(field.key), `editable field ${field.key}`).toBe(false);
    }
  });

  it('keeps credential_reference as a name-only field', () => {
    expect(EDITABLE_FIELDS.some((f) => f.key === 'credential_reference')).toBe(true);
    expect(page).toContain('NAME ONLY');
  });

  it('does not read env vars or secret values in the page', () => {
    expect(page).not.toMatch(/import\.meta\.env/);
    expect(page).not.toMatch(/SERVICE_ROLE/);
    expect(page).not.toMatch(/fetch_secrets|GOOGLE_GEOCODING_API_KEY\s*=/);
  });

  it('stores only credential references in the migration seed, never values', () => {
    // The only credential mention is the reference NAME.
    expect(migration).toContain("'GOOGLE_GEOCODING_API_KEY'");
    expect(migration).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // no JWT-shaped literals
    expect(migration).not.toMatch(/AIza[0-9A-Za-z_-]{10,}/); // no Google key literals
  });
});

describe('Source Registry — access gating', () => {
  it('redirects Public Safe Mode away from the registry', () => {
    expect(page).toContain('isPublicSafeModeActive()');
    expect(page).toMatch(/if \(isPublicSafeModeActive\(\)\) return <Navigate to="\/" replace \/>;/);
  });

  it('gates read access to the backend roles and writes to admin/sysop only', () => {
    expect(page).toContain('const canRead = perms.canAccessOps;');
    expect(page).toContain('const canWrite = perms.isAdmin;');
    // Ops read-only: the edit block is behind canWrite.
    expect(page).toContain('{canWrite && (');
  });
});

describe('Source Registry — RLS in the migration', () => {
  it('enables RLS on both registry tables', () => {
    expect(migration).toContain('ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public.data_source_runs ENABLE ROW LEVEL SECURITY');
  });

  it('grants no privileges to anon', () => {
    expect(migration).not.toMatch(/GRANT[^;]*TO anon/i);
  });

  it('allows ops to read and admin/sysop to write data_sources', () => {
    expect(migration).toContain('data_sources_select_ops_admin_sysop');
    expect(migration).toContain('data_sources_insert_admin_sysop');
    expect(migration).toContain('data_sources_update_admin_sysop');
    expect(migration).toContain('data_sources_delete_admin_sysop');
    // Every write policy names both admin and sysop explicitly.
    const writeBlock = migration.slice(migration.indexOf('data_sources_insert_admin_sysop'));
    expect(writeBlock).toContain("'admin'::public.app_role");
    expect(writeBlock).toContain("'sysop'::public.app_role");
  });

  it('does not give ops a write policy on data_sources', () => {
    expect(migration).not.toMatch(/data_sources_(insert|update|delete)[^\n]*ops/);
  });

  it('keeps data_source_runs append-only (no update or delete policy)', () => {
    expect(migration).toContain('data_source_runs_insert_admin_sysop');
    expect(migration).not.toMatch(/data_source_runs_(update|delete)/);
    expect(migration).toContain('GRANT SELECT, INSERT ON public.data_source_runs TO authenticated');
  });

  it('links runs to sources via a foreign key', () => {
    expect(migration).toMatch(/source_id uuid NOT NULL REFERENCES public\.data_sources\(id\)/);
  });
});

describe('Source Registry — no live rendering dependency', () => {
  it('is not imported by map, Decision Assist, or data modules', () => {
    const consumers = [
      'src/components/map/MapView.tsx',
      'src/components/map/decision-assist/deriveDecisionAssist.ts',
      'src/hooks/useFacilityData.ts',
      'src/hooks/useRuralServiceData.ts',
      'src/hooks/useMemberAccess.ts',
    ];
    for (const file of consumers) {
      const text = read(file);
      expect(text, file).not.toContain('data_sources');
      expect(text, file).not.toContain('lib/sources/sourceHealth');
    }
  });
});
