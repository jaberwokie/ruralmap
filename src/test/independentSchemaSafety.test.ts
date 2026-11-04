import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { allowLegacyStaticPreview } from '@/lib/independentResourcePolicy';

const schema = readFileSync(resolve(__dirname, '../../independent/schema.sql'), 'utf8');

describe('clean backend and source authorization boundaries', () => {
  it('requires explicit local-only opt-in to use unreviewed static pins', () => {
    expect(allowLegacyStaticPreview(false, 'true')).toBe(false);
    expect(allowLegacyStaticPreview(true, undefined)).toBe(false);
    expect(allowLegacyStaticPreview(true, 'false')).toBe(false);
    expect(allowLegacyStaticPreview(true, 'true')).toBe(true);
  });

  it('enables and forces RLS on both independent resource tables', () => {
    for (const table of ['facilities', 'rural_services']) {
      expect(schema).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(schema).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`);
      expect(schema).toContain(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated;`);
    }
  });

  it('only permits approved data to be read by browser roles', () => {
    expect(schema).toMatch(/GRANT SELECT ON TABLE public\.facilities TO anon, authenticated;/);
    expect(schema).toMatch(/GRANT SELECT ON TABLE public\.rural_services TO anon, authenticated;/);
    const approvalGates = schema.match(/USING \(publication_status = 'approved'\)/g) ?? [];
    expect(approvalGates).toHaveLength(2);
    expect(schema).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL) ON TABLE/i);
  });

  it('provides no claims, FTE, member or operational data schema', () => {
    expect(schema).not.toMatch(/\b(member_count|engagement_gap|fte_capacity|utilization|member_volume|payer_pathway|tier|volume|operational)\b/i);
  });
});
