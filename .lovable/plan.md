## Problem

The current OG image uses a Nevada polygon from `glynnbird/usstatesgeojson` that does not match the real state shape. Missing or wrong:

- The sharp NW corner cut where Oregon/Idaho borders meet
- The clean vertical east side along Utah
- The single long diagonal California border going from the NW corner down to the southern tip
- The southeast Colorado-River notch at the AZ border
- The southern Laughlin point

City reach circles also drift outside Nevada in the current render because the bounding shape is wrong.

## Fix

1. **Replace the Nevada source with a verified outline.** Pull from a higher-fidelity, well-known source (try in order until one renders a recognizable Nevada):
   - `us-atlas` (`states-10m.json` from `topojson/us-atlas`) — extract Nevada by FIPS 32, convert TopoJSON → GeoJSON
   - US Census TIGER cartographic boundary (1:5M states GeoJSON)
   - As a final fallback, hand-build from 8 well-known corner coordinates (NW corner, NE corner, SE Utah corner, AZ notch corners, southern tip, CA diagonal anchor)
2. **Verify before compositing.** Render the polygon alone to a debug PNG first and visually confirm it reads as Nevada (NW notch, straight east, single SW diagonal, southern tip). Do not proceed to the full OG composition until that passes.
3. **Rebuild the operational inset using the correct outline.**
   - Same panel chrome (header line, corner ticks, legend) — no logic changes
   - Re-project the existing city points (Reno, Carson, Winnemucca, Elko, Ely, Tonopah, Pahrump, Las Vegas, Pioche) using the new bounds
   - Confirm each circle center sits inside the polygon
4. **Keep everything else identical.** Title, subtitle, supporting line, OpsFrame wordmark, NovumHealth logo, mobile-safe margins, deep-blue palette — unchanged from the current file.
5. **QA pass.** Visually inspect the regenerated `public/og-image.jpg` at 1200×630 and at a portrait crop (LinkedIn / iMessage center crop) before delivery. If the shape still doesn't read as Nevada, iterate the source.

## Scope

- Only `public/og-image.jpg` is touched.
- Generation script lives in `/tmp` (not in the repo).
- No app code, OG metadata, or operational logic changes.

## Out of scope

- The OpsFrame wordmark stays typeset until you upload an actual OpsFrame logo asset (none exists in the repo today).
- No layout, color, or typography redesign — this is strictly a geometry correctness fix.
