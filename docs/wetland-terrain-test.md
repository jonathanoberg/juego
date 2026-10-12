# Wetland image terrain test

The source is the user-provided
`aerial-view-of-a-wetland-ponds-and-trees-2026-09-22-08-09-44-utc.jpg`.
It is not copied into the public repository. Native dimensions are 2048 × 1365
pixels; at 10 pixels/meter the viewport is 204.8 × 136.5 meters.
Center (1024,682.5) is world (0,0), +x right and +y up.
Traces are approximate hand interpretations, not surveyed boundaries.

See [feature schematic](examples/wetland-terrain-map.svg),
[generated terrain](examples/wetland-generated-terrain.png), and
[fixture](../prototyping/fixtures/wetland-terrain.json).

## Features

- Eleven water-body footprints: seven mostly interior ponds/water bodies and
  four additional bodies clipped by the northern, western, or eastern image edge.
  Two of the larger interior water bodies also reach the southern image edge.
  They include the large western pond with its southern connection, an elongated
  central/eastern pond, and a branching southeastern basin. No flow direction or
  off-image connectivity is asserted.
- Four tree stands: western, central/southern, eastern/southern, and scattered
  northern trees. These author placement regions, not terrain ridges or a claim
  that each generated tree matches a photographed tree.
- One wet-ground patch: the dark southwestern depression, without asserting
  that it contains standing water.

## Generation

`npm run prototype:wetland -- /tmp/wetland-generated.json`

`python3 prototyping/render-terrain.py /tmp/wetland-generated.json docs/examples/wetland-generated-terrain.png`

The shared generator produces 10,755 base-cell center samples, including 2,133
open-water centers, plus 271 separate situated trees with stable identities.
Counts depend on the current fixture and prototype revision. Generated results
are exported only on request; they are not persisted in the database.

The background prototype uses organic ground, dampness, low vegetation, and
small relative relief. These are design assumptions inspired by the image.
Pond footprints establish basin interiors and water state. Synthetic depths of
0.6–1.1 meters taper smoothly toward shores; 1.2–2 meter bank margins affect wetness.
Drying a pond removes water without removing its basin.

Tree candidates use a stable four-meter world lattice with positional jitter,
stand probabilities, and synthetic crown/height ranges. Root positions cannot
be in explicitly water-covered terrain. Tree height does not modify ground
height. Overlapping stands select one applicable stand by feature priority and
stable ID, preventing duplicate objects. Object queries select by root position;
future spatial queries may also need crowns intersecting the viewport.

## Model implications and limits

Terrain basins, current water, wet shore margins, and trees remain distinct.
The fixture's pond influence envelopes include banks for future spatial lookup;
the rectangles are not physical water outlines. Basin geometry is clipped at the
image edge; subsequent geography may extend or connect it.

This still does not simulate water-surface levels, seasonal flooding, peat
mechanics, tree collision, or growth. Center sampling approximates shore coverage.
There is no actor navigation or database integration. Local basin depths are not
photo measurements, and continuous height ramps do not establish a hydrological
simulation. Terrain defaults use the selected prototype directly; sparse region
inheritance remains unimplemented.

Tests verify smooth shores, independent dry/wet state, dry polygon holes,
deterministic overlapping object queries, no underwater tree roots, unchanged
ground heights after object generation, and stable feature ordering.
