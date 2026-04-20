

## Add Real Map Screenshots to Walkthrough PDF

Replace the labeled placeholder boxes in `/mnt/documents/rural-map-walkthrough.pdf` with real screenshots of the live map, captured from the running preview.

### Capture set (14 screenshots)

**10 base section screenshots** — one per demo step, captured at viewport 1302×843:

| # | Section | Map state to set up |
|---|---|---|
| 1 | Orientation | Full map, no filters, no selection, default zoom |
| 2 | Listed Resources ≠ Usable Options | Core Map layers visible (Providers + Behavioral Health + Services on) |
| 3 | Geography Drives Constraints | Rural county selected (Eureka), tribal layer on |
| 4 | Member-Level Reality | Member address entered in Pahrump, pin + access tiers visible |
| 5 | Distance ≠ Access | Same member view, Coverage Detail panel open showing tiered list |
| 6 | CHW Ownership Model | County panel open showing Engagement Ownership block |
| 7 | Verified vs Assumed Access | Detail panel showing verification chips |
| 8 | Connectivity Defines Feasibility | Broadband + Cellular layers active over rural county |
| 9 | This Informs Decisions, It Doesn't Make Them | County detail with NBH Routing + Transportation Coordination visible |
| 10 | Known Limits | Map Explainer modal open on the Limits content |

**4 comparison pairs** (8 screenshots) — captured as matched pairs at the same zoom and layer state:

| Pair | Left | Right |
|---|---|---|
| Member presence | Map, no member placed | Same map, member pin + access tiers |
| Verification trust | Detail panel — unverified provider | Detail panel — verified provider |
| CHW ownership | County panel — Primary CHW (Carson City) | County panel — Remote CHW (Eureka) |
| County access contrast | High-access county (Washoe) | Low-access county (Esmeralda) |

### Capture process

1. `browser--navigate_to_sandbox` at 1302×843.
2. For each capture: drive UI via `browser--act` (toggle layers, click county, enter member address, open panel), then `browser--screenshot`.
3. Save raw screenshots to `/tmp/walkthrough/<id>.png`.
4. Light annotation pass with Pillow (numbered circle callouts + arrows where the existing PDF references specific UI regions). No heavy overlays.

### PDF rebuild

- Reuse the existing ReportLab generator script for the walkthrough.
- Replace each placeholder block with `Image(path, width=..., preserveAspectRatio=True)`.
- Comparison pairs render as a 2-column row with shared caption underneath.
- Output to `/mnt/documents/rural-map-walkthrough_v2.pdf` (keeps v1 intact for comparison).

### Mandatory QA

- `pdftoppm -jpeg -r 150 /mnt/documents/rural-map-walkthrough_v2.pdf /tmp/qa/page` then inspect every page via `code--view`.
- Check for: clipped screenshots, wrong screenshot in wrong section, illegible scale, broken pair alignment, overflow into Q&A pages.
- Fix and re-render until clean. Report what was checked and any issues found.

### Out of scope
- No changes to overlay code, callout text, or Q&A content.
- No new sections or pages — same structure as v1.
- v1 PDF left in place; v2 is the deliverable.

### Note on browser usage
This step requires the browser tool to capture real preview screenshots. Browser tools are gated to explicit user requests — your message authorizes this use for the screenshot capture only.

