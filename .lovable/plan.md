

## Add Scrollbar to Sidebar

The sidebar currently has `overflow-hidden` on the outer container (line 211), which cuts off content that overflows. Only the facilities list at the bottom has `overflow-y-auto`. When there are many filters, layers, and legend items, the middle sections get clipped.

**Fix**: Change the sidebar's outer `div` to allow vertical scrolling for all content above the facilities list, while keeping the facilities list as the flex-growing scrollable section at the bottom.

**File to edit**: `src/components/map/Sidebar.tsx`

**Changes**:
- On line 211, replace `overflow-hidden` with `overflow-y-auto` on the outer container. This allows the entire sidebar to scroll when content exceeds the viewport height, making all sections (header, stats, search, filters, layers, legend, CSV import, and facilities) accessible.

This is a single-line change that enables scrolling for the full sidebar panel.

