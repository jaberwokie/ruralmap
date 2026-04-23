

## Lighten the Nevada silhouette fill in the OG image

Reduce the opacity of the Nevada silhouette in `public/og-image.jpg` so it reads as a softer background element rather than a competing block of color.

### Change

- Drop the silhouette fill opacity from ~40% to ~20% (NovumHealth blue `#064f88`).
- Keep everything else identical: position (right side), shape (real Nevada geometry), logo, title, subtitle, OpsFrame.io footer.
- Regenerate `public/og-preview.jpg` first for review, then promote to `public/og-image.jpg` once you confirm.

### Open question

If 20% feels too faint at preview size, I'll bump to 25%. Say the word if you'd rather go even lighter (~15%) or skip the preview step and ship directly.

