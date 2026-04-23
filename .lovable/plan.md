

## Update OG image: replace abstract square with Nevada outline

Swap the generic geometric shape currently sitting on the right side of `public/og-image.jpg` for a clean Nevada state silhouette, keeping all other branding (NovumHealth logo, title, subtitle, OpsFrame.io footer) exactly as approved.

### Approach

1. Use the real Nevada boundary geometry already in the project (`src/data/nevada-boundary.ts`) so the silhouette is geographically accurate — not a fake polygon.
2. Render it as a filled shape in NovumHealth blue (`#064f88`) at ~30–50% opacity, sized to occupy roughly the same visual zone as the current square (right third of the canvas).
3. Keep it minimal: solid silhouette only, no county lines, no pins, no labels. It must read instantly at small preview sizes.
4. Regenerate `public/og-preview.jpg` first for review, then promote to `public/og-image.jpg` once approved.

### Layout (unchanged except for the shape)

```text
┌─────────────────────────────────────────────┐
│ [NovumHealth logo]                          │
│                                             │
│  Rural Operations Map           ⬢ Nevada    │
│  Nevada Rural BH Coverage…      silhouette  │
│                                             │
│              BUILT ON                       │
│             OpsFrame.io                     │
└─────────────────────────────────────────────┘
```

### Open questions

- **Style**: filled silhouette (solid NovumHealth blue, ~40% opacity) or outlined only (stroke, no fill)?
- **Position**: keep it on the right side where the square is now, or center it behind the title as a faint watermark?

I'll default to **filled silhouette, right side, ~40% opacity** unless you say otherwise. Want me to generate the preview now?

