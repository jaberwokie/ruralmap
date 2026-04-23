

## Fix Nevada silhouette aspect ratio in OG image

The current silhouette in `public/og-image.jpg` is distorted because width and height were scaled independently. Nevada has a real aspect ratio of roughly 0.62 (W/H) — taller than wide, with the angled southern "boot" on the bottom-right.

### Change

- Rebuild the silhouette using the authoritative coordinates in `src/data/nevada-boundary.ts`.
- Compute scale as a single uniform factor (`scale = target_h / geo_height`) so width is derived from real geometry — never stretched to fit.
- Use a Mercator-style latitude correction (`x *= cos(mean_lat)`) so the shape matches how Nevada actually appears on a map instead of looking squashed.
- Target height ~520px; resulting width will land near ~310–330px (correct proportions).
- Keep all current styling: ~9% blue fill, thin darker outline, anchored to the right edge with part of the shape off-frame, positioned to avoid the title/subtitle block.
- Nothing else in the OG image changes (logo, title, subtitle, footer, background).

### Technical details

- Update the Python generator script: replace the independent x/y scaling with `scale = target_h / (lat_max - lat_min)`, apply `cos(radians(mean_lat))` to longitudes before scaling, then translate so the bounding box sits flush against `right_anchor = W - 20`.
- Regenerate `public/og-image.jpg` and QA by rendering the file to a preview image and visually confirming the recognizable Nevada outline (vertical western border, angled southern boot) before finishing.

