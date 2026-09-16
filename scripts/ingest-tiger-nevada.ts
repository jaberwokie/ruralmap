/**
 * Phase 2E — one-time / re-runnable ingestion of PUBLIC U.S. Census TIGER/Line
 * ADDRFEAT street address ranges for Nevada into `public.tiger_street_ranges`.
 *
 * This is the reference dataset that powers the internal member-address
 * geocoder. It contains NO member data whatsoever: street names, TIGER address
 * ranges, ZIP/county identifiers, and line geometry only.
 *
 * Run (Nevada only, all 17 counties, replaces the previous vintage):
 *
 *   TIGER_VINTAGE=2024 bun run scripts/ingest-tiger-nevada.ts
 *
 * Requires `psql` plus a database URL in SUPABASE_DB_URL (or PG* env vars).
 * To adopt a newer TIGER vintage, re-run with TIGER_VINTAGE set to that year.
 *
 * Street identity keys come from the SAME module the resolver uses
 * (`supabase/functions/_shared/tigerStreetKey.ts`), so ingestion and lookup can
 * never drift apart.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { normalizeStreetName } from '../supabase/functions/_shared/tigerStreetKey.ts';

const VINTAGE = process.env.TIGER_VINTAGE ?? '2024';
const WORK = process.env.TIGER_WORKDIR ?? '/tmp/tiger-nevada';
const BASE = `https://www2.census.gov/geo/tiger/TIGER${VINTAGE}/ADDRFEAT`;

/** Nevada county FIPS (32025 Ormsby no longer exists; Carson City is 510). */
const NV_COUNTIES = [
  '001', '003', '005', '007', '009', '011', '013', '015', '017',
  '019', '021', '023', '027', '029', '031', '033', '510',
];

interface DbfField { name: string; length: number }

const readDbf = (buf: Buffer): Record<string, string>[] => {
  const numRec = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recLen = buf.readUInt16LE(10);
  const fields: DbfField[] = [];
  let pos = 32;
  while (buf[pos] !== 0x0d) {
    const name = buf.subarray(pos, pos + 11).toString('latin1').replace(/\0.*$/, '');
    fields.push({ name, length: buf[pos + 16] });
    pos += 32;
  }
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < numRec; i++) {
    let off = headerLen + i * recLen + 1;
    const row: Record<string, string> = {};
    for (const f of fields) {
      row[f.name] = buf.subarray(off, off + f.length).toString('latin1').trim();
      off += f.length;
    }
    rows.push(row);
  }
  return rows;
};

/** Read polyline geometry records from a .shp file, in record order. */
const readShpPolylines = (buf: Buffer): [number, number][][] => {
  const shapes: [number, number][][] = [];
  let pos = 100;
  while (pos < buf.length) {
    const contentLen = buf.readUInt32BE(pos + 4) * 2;
    const rec = buf.subarray(pos + 8, pos + 8 + contentLen);
    pos += 8 + contentLen;
    if (rec.readUInt32LE(0) !== 3) { shapes.push([]); continue; }
    const numParts = rec.readUInt32LE(36);
    const numPoints = rec.readUInt32LE(40);
    const pOff = 44 + numParts * 4;
    const pts: [number, number][] = [];
    for (let i = 0; i < numPoints; i++) {
      const x = rec.readDoubleLE(pOff + i * 16);
      const y = rec.readDoubleLE(pOff + i * 16 + 8);
      pts.push([Number(x.toFixed(6)), Number(y.toFixed(6))]);
    }
    shapes.push(pts);
  }
  return shapes;
};

const sh = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });

const main = async () => {
  mkdirSync(WORK, { recursive: true });
  const tsvPath = `${WORK}/tiger_street_ranges.tsv`;
  const out: string[] = [];
  let features = 0;

  for (const county of NV_COUNTIES) {
    const stem = `tl_${VINTAGE}_32${county}_addrfeat`;
    const zip = `${WORK}/${stem}.zip`;
    if (!existsSync(zip)) {
      const res = await fetch(`${BASE}/${stem}.zip`);
      if (!res.ok) throw new Error(`download failed for 32${county}: ${res.status}`);
      writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    }
    sh('unzip', ['-o', '-q', zip, '-d', WORK]);

    const recs = readDbf(readFileSync(`${WORK}/${stem}.dbf`));
    const shapes = readShpPolylines(readFileSync(`${WORK}/${stem}.shp`));

    for (let i = 0; i < recs.length; i++) {
      const r = recs[i];
      const geom = shapes[i];
      features++;
      if (!geom || geom.length === 0) continue;
      const fullname = (r.FULLNAME ?? '').trim();
      if (!fullname) continue;
      const { streetKey, streetCore } = normalizeStreetName(fullname);
      if (!streetKey) continue;
      const geomJson = JSON.stringify(geom);

      for (const side of ['L', 'R'] as const) {
        const from = r[`${side}FROMHN`] ?? '';
        const to = r[`${side}TOHN`] ?? '';
        if (!/^\d+$/.test(from) || !/^\d+$/.test(to)) continue;
        const parity = (r[`PARITY${side}`] ?? '').trim();
        const zipc = (r[`ZIP${side}`] ?? '').trim();
        out.push([
          VINTAGE,
          `32${county}`,
          r.TLID ?? '',
          side,
          fullname,
          streetKey,
          streetCore,
          from,
          to,
          parity || '\\N',
          /^\d{5}$/.test(zipc) ? zipc : '\\N',
          geomJson,
        ].join('\t'));
      }
    }
    console.log(`parsed 32${county}: ${out.length} range rows so far`);
  }

  writeFileSync(tsvPath, out.join('\n') + '\n');
  console.log(`features=${features} rows=${out.length} -> ${tsvPath}`);

  const dbUrl = process.env.SUPABASE_DB_URL;
  const psqlArgs = dbUrl ? [dbUrl] : [];
  const copy =
    `\\set ON_ERROR_STOP on\n` +
    `BEGIN;\n` +
    `DELETE FROM public.tiger_street_ranges;\n` +
    `\\copy public.tiger_street_ranges (vintage, county_fips, tlid, side, fullname, street_key, street_core, from_hn, to_hn, parity, zip, geom) FROM '${tsvPath}' WITH (FORMAT text)\n` +
    `COMMIT;\n` +
    `SELECT count(*) AS loaded_rows FROM public.tiger_street_ranges;\n`;
  writeFileSync(`${WORK}/load.sql`, copy);
  const res = sh('psql', [...psqlArgs, '-v', 'ON_ERROR_STOP=1', '-f', `${WORK}/load.sql`]);
  console.log(res.toString());
};

await main();
