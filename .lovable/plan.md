

## Update All Facility Coordinates to Building-Level Accuracy

### What's Changing

Replace the approximate city-center coordinates for all 17 facilities with precise building-level coordinates sourced from OpenStreetMap's geocoding service (Nominatim), matched to verified street addresses.

### Coordinate Updates

**Hospitals** (all geocoded from OSM building footprints):

| Facility | Current Lat/Lng | New Lat/Lng | Address |
|---|---|---|---|
| Desert View Hospital | 36.2083, -115.9839 | 36.2142, -116.0248 | 360 S Lola Ln, Pahrump |
| Banner Churchill | 39.4735, -118.7774 | 39.4762, -118.7662 | 801 E Williams Ave, Fallon |
| Carson Tahoe Regional | 39.1612, -119.7674 | 39.2011, -119.7841 | 1600 Medical Pkwy, Carson City |
| Northeastern Nevada Regional | 40.8324, -115.7631 | 40.8230, -115.7314 | 2001 Errecart Blvd, Elko |
| William Bee Ririe | 39.2549, -114.8886 | 39.2556, -114.8596 | 1500 Avenue H, Ely |
| Battle Mountain General | 40.6422, -116.9343 | 40.6399, -116.9407 | 535 S Humboldt St, Battle Mountain |
| South Lyon Medical Center | 38.9860, -119.1624 | 38.9841, -119.1674 | 213 S Whitacre St, Yerington |
| Mount Grant General | 38.5249, -118.6240 | 38.5166, -118.6274 | 200 S A St, Hawthorne |
| Humboldt General | 40.9729, -117.7357 | 40.9711, -117.7265 | 118 E Haskell St, Winnemucca |

**Clinics** (geocoded from verified street addresses):

| Facility | Current Lat/Lng | New Lat/Lng | Address |
|---|---|---|---|
| NHC Pahrump | 36.2083, -115.9839 | 36.1943, -115.9664 | 1430 E Calvada Blvd, Pahrump |
| NHC Carson City | 39.1638, -119.7674 | 39.1757, -119.7670 | 1802 N Carson St, Carson City |
| NHC Fallon | 39.4735, -118.7774 | 39.4749, -118.7727 | E Williams Ave, Fallon |
| NHC Elko | 40.8324, -115.7631 | 40.8416, -115.7584 | 762 14th St, Elko |
| NHC Ely | 39.2549, -114.8886 | 39.2547, -114.8610 | Near 1500 Avenue H, Ely |
| CHA Dayton | 39.2374, -119.5929 | 39.2374, -119.5929 | (no CHA location found; keeping best available) |
| CHA Carson | 39.1638, -119.7674 | 39.1674, -119.7683 | Carson City area |
| First Med Fallon | 39.4735, -118.7774 | 39.4768, -118.7690 | 560 E Williams Ave, Fallon |

### Technical Details

Single file change: `src/data/facilities.ts` -- update all `lat` and `lng` values in the `defaultFacilities` array.

Notable corrections:
- **Desert View Hospital** was off by ~3.8 km (city center vs actual building on S Lola Ln)
- **Carson Tahoe Regional** was off by ~4.6 km (the hospital campus is in north Carson City)
- **William Bee Ririe** and **Northeastern Nevada Regional** were off by ~2-3 km
- Clinic markers will no longer overlap with hospital markers in the same city (e.g., Pahrump clinic is on Calvada Blvd, ~2.5 km from the hospital)

