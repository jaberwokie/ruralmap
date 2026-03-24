

## Add Address Display to All Pin Tooltips

### Problem
The address-in-tooltip fix was only applied to provider location pins. Rural services (green) and behavioral health (purple) pins still omit the street address from their tooltips, making it impossible to verify pin-to-address alignment for those layers.

### Changes

**File: `src/components/map/MapView.tsx`**

1. **Rural services tooltip** (~line 1437): Add the `service.address` line between the city/county line and the category line, matching the provider tooltip pattern:
   ```
   ${service.address ? `<div style="color: hsl(240, 4%, 46%); font-size: 10px; margin-top: 1px;">${service.address}</div>` : ''}
   ```

2. **Behavioral health tooltip** (~line 1494): Same addition between city/county and category lines.

### What stays the same
- Provider tooltips (already have address)
- County/FTE tooltips (no street address concept)
- All coordinates, data, and rendering logic

### Impact
All pin types on the map will display their street address in the tooltip, allowing verification of pin-to-address alignment across every layer.

