
Goal

Fix the actual styling bug and redesign Service Presence so it reads as a soft background field using hollow ring markers, not heavy black debug-looking dots.

What I found

- The current Service Presence layer is still being drawn from `MapView.tsx` as individual Leaflet `circleMarker`s with a halo.
- The screenshot matches a real implementation bug: the layer uses strings like `hsla(var(--service-presence), 0.42)` and `hsla(var(--service-presence), 0.12)`.
- That syntax is not valid for the space-separated CSS variable value in `index.css` (`--service-presence: 210 28% 62%`), so Leaflet/SVG falls back to black in some cases.
- Result: the Service Presence layer still gets harsh black rings and looks like debug artifacts instead of a soft support layer.

Implementation plan

1. Fix the color syntax bug at the source
- Update Service Presence marker/halo colors in `src/components/map/MapView.tsx` to valid color strings.
- Use modern `hsl(210 28% 62% / 0.42)`-style syntax or explicit resolved color constants.
- Remove every invalid `hsla(var(--service-presence), ...)` usage for this layer.

2. Redesign Service Presence as hollow ring markers
- Switch the point styling from a filled dot emphasis to a small hollow ring:
  - transparent or near-transparent center
  - thin muted stroke
  - no black border
  - slightly smaller than Provider Locations
- Keep the marker visually quiet so Provider Locations and Hospitals stay dominant.

3. Keep a faint density halo behind each ring
- Preserve individual points at all zoom levels.
- Keep a very soft halo behind each Service Presence point so overlap still communicates density.
- Lower halo opacity enough that dense areas read heavier without becoming blotchy.

4. Preserve current interaction behavior
- Keep individual service tooltips and click behavior.
- Keep county-level service count in the hover panel only, not as map labels.
- Do not change Provider Locations styling or logic.

5. Tune for dense counties
- Keep the existing deterministic overlap offset logic.
- Slightly reduce service ring radius if needed after the color fix so Carson/Douglas/Washoe stay readable.
- Ensure rural counties still show sparse presence clearly.

Likely file changes

- `src/components/map/MapView.tsx`
  - Replace invalid Service Presence color strings
  - Restyle Service Presence markers as hollow rings with subtle halos
  - Keep current individual-point rendering and interactions
- `src/index.css`
  - Optionally refine `--service-presence` to a softer muted tone if the current hue still feels too strong after the syntax fix

Technical details

```text
Current bug:
hsla(var(--service-presence), 0.42)
var(--service-presence) = "210 28% 62%"
This expands to invalid CSS for hsla(...), causing fallback rendering.

Planned fix:
Use valid color strings such as:
hsl(var(--service-presence) / 0.42)
or explicit constants like:
hsl(210 28% 62% / 0.42)
```

Acceptance criteria

- No black ring effect anywhere on Service Presence markers
- Service Presence reads as a soft supporting layer, not a primary anchor
- Provider Locations remain sharper and visually dominant
- Dense counties are calmer and easier to scan
- Rural gaps remain obvious
- No clustering, count bubbles, or persistent map labels return
