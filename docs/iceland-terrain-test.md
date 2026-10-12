# Iceland photograph terrain test

Source: user-provided `aerial-view-over-the-hills-in-iceland-2026-09-22-08-30-02-utc.jpg`.
The original photograph is not copied into the public repository.
This is a hand-interpreted example under the requested top-down convention,
not photogrammetry or a surveyed terrain model.

The 2048 × 954 image becomes 204.8 × 95.4 meters. Image center (1024,477)
is world (0,0); +x points right, +y points up, without asserting geographic north.
`x = (pixelX - 1024)/10`, `y = (477 - pixelY)/10`.

See [schematic](examples/iceland-terrain-map.svg) and
[authoring fixture](../prototyping/fixtures/iceland-terrain.json).
Run `node prototyping/iceland-map-demo.ts` to inspect the mapping, or pass an
output JSON path to export complete region footprints. No database is modified.

## Mapping to storage

| Record | Representation |
| --- | --- |
| World | Local meter grid, one-meter base edges, alternating aperture-7 |
| TerrainGenerator | Proposed rocky-ground/low-vegetation background; no implementation yet |
| TerrainRegion | Three level-five specifications cover the viewport, inheriting a shared background |
| TerrainFeature | Twelve traced features; vegetation and exposed slopes supply explicit patches |
| TerrainOverride | None; no edits made to the world yet |
| TerrainBoundary | None authored; cliff/ridge intersections with cell edges would be derived |

Fixture region footprints are derived from cell addresses rather than embedded
as thousands of repeated coordinates. The export helper includes their exact
GeoJSON polygons, which extend beyond the rectangular viewport. Feature
geometries are already supplied in world-meter coordinates. Spatial fields are
GeoJSON specifications that a future database loader must convert to SRID-0
geometry; this file is not directly importable SQL. Numeric revisions and seeds
are prototype values, not persistence-layer concurrency handling.

## Interpreted features

1. Western winding channel: visible sinuous corridor, approximately (-78,47.7)
   to (-51,-13.3). Water is probable, substrate and flow direction unspecified.
2. Southern continuation: approximately (-51,-13.3) to (-61.9,-38.2).
3. Western branch/drainage: joins near (-51,-13.3); interpretation uncertain.
4. Small southern pool: near (-57.5,-30.3), roughly three meters across.
5. Western green ground: vegetation patch, not a separate hill type or object.
6. Northern moss-like cover: patchy low vegetation; species not established.
7. Western exposed slope: exposed earth/loose rock, sparse vegetation.
8. Northern western break of slope: tentative crest/rock-step trace.
9. Central rocky escarpment: irregular face corridor near the center/right.
10. Eastern rocky escarpment: additional face corridor across the eastern side.
11. Central foreground ridge: crest around (7.6,-7.2); rises toward the crest
    are a qualitative interpretation, not measured gradients.
12. Eastern incision: possible gully; no water asserted.

Channel widths are approximate visual estimates. For line features, influence
footprints are intentionally generous rectangular retrieval envelopes; they
must NOT be treated as actual channel width or collision geometry. Polygon
patches use their own footprint. Spatial conflicts between patches will need
our eventual feature-composition rules. Unspecified wetness, slope magnitude,
height, passability, pool depth, or species remain unspecified.

## Model implications

Major geography is stored once and intersected with whichever cells are queried.
A channel is distinct from its current water state. Escarpments are continuous
spatial features; per-cell transitions are derived at the chosen resolution.
Named overlapping regions still require a separate model from cell specifications.
This example specifies background and patch inputs but does not yet generate
terrain, enforce slope consistency, or derive transitions in the simulation.
