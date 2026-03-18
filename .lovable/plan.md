

## Plan: Clear focus area when Coverage Areas toggle changes

**`src/pages/Index.tsx`** — In `handleToggleLayer`, when the `zones` layer is toggled, clear `focusedArea`:

```diff
  const handleToggleLayer = useCallback((layer: keyof LayerState) => {
    setLayers(prev => {
      const next = { ...prev, [layer]: !prev[layer] };
      if (layer === 'serviceLocations' && !next.serviceLocations) {
        setCoverageRadius(false);
      }
+     if (layer === 'zones') {
+       setFocusedArea(null);
+     }
      return next;
    });
  }, []);
```

Single change, one file.

