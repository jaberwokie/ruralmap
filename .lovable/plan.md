

## Convert Rural Map Walkthrough to Editable DOCX

Produce an editable Word version of `rural-map-walkthrough_v2.pdf` so you can add, remove, or reword any text directly. The PDF stays in place; the DOCX is the new editable artifact.

### Approach

Generate `/mnt/documents/rural-map-walkthrough_v2.docx` from scratch using `docx-js`, mirroring the existing PDF's structure 1:1. This produces clean, fully editable Word content (real paragraphs, headings, tables, lists) rather than a converted PDF — which would be locked into text boxes and broken layout.

Screenshots already captured in `/tmp/walkthrough/` are reused and embedded inline.

### Document structure (matches v2 PDF)

1. Cover page — title, subtitle, audience line
2. Table of contents
3. **10 walkthrough sections**, each with:
   - Heading 1 title
   - 2–4 sentence narrative paragraph
   - Embedded screenshot (sized to fit content width, preserves aspect)
   - "Operational meaning" bullet list
   - "Plan/contract meaning" bullet list
   - Plain-language summary line (italic)
4. **4 comparison pair pages** (Member presence, Verification trust, CHW ownership, County access) — two screenshots side-by-side in a 2-column table, shared caption row underneath
5. **Q&A appendix** — 10 categories, 47 questions; each as Heading 2 (question) + body paragraph (answer)

### Formatting

- US Letter, 1" margins
- Arial throughout (default), black headings
- H1 24pt bold, H2 16pt bold, body 11pt
- Bullets via `LevelFormat.BULLET` (no unicode bullets)
- Tables use `WidthType.DXA` with matched `columnWidths` and cell widths
- Page breaks between sections via `PageBreak` inside a paragraph
- Comparison images sized to ~4.3" wide each so a pair fits one row

### QA (mandatory)

1. Convert DOCX → PDF via LibreOffice
2. `pdftoppm -jpeg -r 150` → inspect every page with `code--view`
3. Check for: clipped images, broken pair alignment, wrong screenshot under wrong caption, overflow into Q&A pages, font fallback boxes
4. Fix and re-render until clean. Report what was checked and any issues found.

### Out of scope

- No content changes (same titles, narratives, bullets, Q&A as v2 PDF)
- No new screenshots — reuses `/tmp/walkthrough/*.png`
- v2 PDF left in place; DOCX is additive (`rural-map-walkthrough_v2.docx`)
- No changes to app code or Presentation Mode

