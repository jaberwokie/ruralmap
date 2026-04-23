

## Shift Nevada silhouette left in OG image

The Nevada silhouette currently sits flush against the right edge of `public/og-image.jpg`. Lift it inward so it has visible breathing room on the right and reads as a deliberate background element instead of being clipped to the canvas edge.

### Change

- Shift the silhouette ~60px to the left so it no longer hugs the right edge.
- Keep all other properties identical: shape geometry, ~520px height, uniform Mercator scaling, ~9% blue fill, thin darker outline, vertical position.
- Title, subtitle, NovumHealth logo, and footer attribution remain untouched.

### Technical details

- In the Python generator script, change `right_anchor = W - 20` to `right_anchor = W - 80` (roughly 60px inward from the current position).
- Regenerate `public/og-image.jpg` and QA by rendering the file to a preview image to confirm the silhouette has clear right-side margin and still does not overlap the title/subtitle block.

