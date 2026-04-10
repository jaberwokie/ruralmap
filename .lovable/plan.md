

## Fix: OG Image File Format Mismatch

### Root Cause
`public/og-image.jpg` is a PNG file incorrectly saved with a `.jpg` extension. Social preview crawlers and image renderers detect the format mismatch and fail to display it.

### Plan

1. **Rename the file** from `public/og-image.jpg` to `public/og-image.png`

2. **Convert to actual JPEG** (preferred — smaller file size, better OG compatibility):
   - Use Python/Pillow to convert the PNG to a real JPEG file
   - Save as `public/og-image.jpg` (overwriting the broken one)

3. **Update `index.html`** meta tags if the filename changes (only needed if we go with `.png` rename)

**Recommended approach**: Convert to real JPEG in-place so no HTML changes are needed. This keeps the existing `/og-image.jpg` path working.

### Files Changed
- `public/og-image.jpg` — re-encoded as actual JPEG

