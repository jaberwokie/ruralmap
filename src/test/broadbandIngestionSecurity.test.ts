/**
 * Phase 2A — security invariants for the broadband internalization path.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const migrationsDir = join(root, 'supabase', 'migrations');

const broadbandMigrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .filter((sql) => sql.includes('broadband_county_coverage') || sql.includes('data_source_snapshots'));

const migrationSql = broadbandMigrations.join('\n');

describe('broadband internalization security', () => {
  it('has a migration for the new tables', () => {
    expect(broadbandMigrations.length).toBeGreaterThan(0);
  });

  it('grants no anonymous write access', () => {
    const anonGrants = migrationSql.match(/GRANT[^;]*TO\s+anon[^;]*;/gi) ?? [];
    for (const grant of anonGrants) {
      expect(grant).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALL)\b/i);
    }
  });

  it('keeps snapshots append-only for application roles', () => {
    expect(migrationSql).not.toMatch(/CREATE POLICY[^;]*data_source_snapshots[^;]*FOR\s+(UPDATE|DELETE)/is);
    expect(migrationSql).toMatch(/data_source_snapshots_insert_admin_sysop/);
  });

  it('does not add a SECURITY DEFINER function', () => {
    expect(migrationSql).not.toMatch(/SECURITY\s+DEFINER/i);
  });

  it('contains no secret-like literals', () => {
    expect(migrationSql).not.toMatch(/service_role_key|eyJ[A-Za-z0-9_-]{10,}|api[_-]?key\s*=\s*'/i);
  });

  it('never references the service-role key from client code', () => {
    const clientFiles = ['src/data/broadband-coverage.ts', 'src/hooks/useBroadbandData.ts'];
    for (const file of clientFiles) {
      const contents = readFileSync(join(root, file), 'utf8');
      expect(contents).not.toMatch(/SERVICE_ROLE|service_role/);
    }
  });

  it('keeps the ingestion path out of the client bundle', () => {
    const contents = readFileSync(join(root, 'src/data/broadband-coverage.ts'), 'utf8');
    expect(contents).not.toMatch(/ingest-fcc-broadband/);
    expect(contents).not.toMatch(/fcc\.gov|broadbandmap/i);
  });

  it('retains the static fallback', () => {
    const contents = readFileSync(join(root, 'src/data/broadband-coverage.ts'), 'utf8');
    expect(contents).toContain('/data/nevada_broadband.json');
  });
});
