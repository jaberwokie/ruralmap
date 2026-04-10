

## Problem
The heat layer parameters are too conservative — small radius, high blur, low minimum opacity, and a gradient that starts transparent too late. Result: faint, barely visible hotspots.

## Fix — Boost heat layer intensity

In `src/components/map/MapView.tsx`, update the `heatLayer` configuration (around line 2312):

### Parameter changes
| Parameter | Current | New | Why |
|-----------|---------|-----|-----|
| `radius` | 30 | 50 | Larger hotspot footprint |
| `blur` | 20 | 25 | Slightly softer edges but still defined |
| `maxZoom` | 10 | 12 | Maintain intensity at higher zooms |
| `max` | 1.0 | 0.6 | Lower ceiling = more points hit full intensity |
| `minOpacity` | 0.15 | 0.35 | Base visibility much higher |

### Gradient shift — start color earlier
```
0.0:  'transparent'
0.15: '#FFF3E0'    (was 0.3)
0.3:  '#FFB74D'    (was 0.45)
0.45: '#F57C00'    (was 0.6)
0.6:  '#E64A19'    (was 0.75)
0.75: '#D32F2F'    (was 0.9)
0.9:  '#B71C1C'    (was 1.0)
1.0:  '#880E4F'    (new — deep crimson cap)
```

### Weight scaling — more aggressive
- Change power from `0.6` to `0.45` (top counties get even more relative weight)
- Increase secondary point weight multiplier from `0.4` to `0.6`
- Increase spread from `0.08` to `0.12` for broader county coverage
- Lower cutoff from `0.30` to `0.15` so more mid-tier counties show faintly

### Files
- `src/components/map/MapView.tsx` — single file, ~15 lines changed

