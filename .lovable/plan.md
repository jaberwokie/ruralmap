## Fix Dr. Ronald Pak, PsyD LLC pin location

The pin currently plots at `36.2100, -115.9920` — roughly 2nd Street in central Pahrump, ~0.9 mi from the actual Frontage Rd block. The stated address `311 S Frontage Rd, Ste 106, Pahrump, NV 89048` geocodes (US Census, TIGER) to `36.22144, -115.99446`.

Per existing verification notes (`operational-metadata.ts:151`), the Pahrump address itself is **unconfirmed** — NPPES only lists Pak at a Las Vegas location. So the current `dataConfidence: "Verified"` tag is overstated. Downgrade in the same edit to keep the data record honest.

### Changes

**1. `src/data/facilities.ts` line 149 (record `t14`)**
- `lat: 36.2100` → `lat: 36.22144`
- `lng: -115.9920` → `lng: -115.99446`
- `dataConfidence: "Verified"` → `dataConfidence: "Likely Accurate"`

(5-decimal precision per project Core rule.)

### Out of scope

- No changes to `operational-metadata.ts` — verification notes there already accurately describe the unconfirmed status.
- No changes to address string, county, NPI, or any other field.
- No changes to other files.

### Verification after edit

- Reload preview, click the t14 pin, confirm it sits on S Frontage Rd block 100–499 (immediately west of NV-160 / Pahrump Valley Hwy, near the 311 building).
- Confirm details panel still shows the Pahrump address and `Likely Accurate` confidence.
