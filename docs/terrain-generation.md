# Terrain generation prototype

Run `npm run prototype:terrain` for statistics, or
`npm run prototype:terrain -- /tmp/iceland-generated.json` to export generated
samples. With Python and Pillow installed, render the export with
`python3 prototyping/render-terrain.py /tmp/iceland-generated.json`.
The renderer's optional second argument selects its output PNG.
See [generated terrain](examples/iceland-generated-terrain.png).

This implements the approved terrain-only experiment. It does not write a
database, calculate movement costs, or integrate a runtime persistence layer.

## Generation

`TerrainGenerator` owns a snapshot of a prototype, authored features, and local
edits. Sampling is a pure coordinate-based calculation: it does not consume a
sequential random stream. World ID and seed salt continuous interpolated noise.
Prototype changes may alter terrain; its revision identifies cache contents.

Background: rock/soil, varying low vegetation density, and smooth small-scale
relative relief. Vegetation and exposed-slope polygons change surface properties.
Channels lower the ground through a flat bed and smoothly rising bank shoulders.
Water state is independent of the channel: a dry channel retains its bed.
Pools lower their basin footprint and apply explicit illustrative water state.
The ridge adds a smooth raised crest. Escarpments add signed height steps across
polylines, tapering at their endpoints and outside their influence corridor.

The internal height field has an arbitrary zero. Heights are sampled as needed,
not stored per cell. Directional edge differences derive from the same field,
reverse consistently, and telescope around closed routes. A height discontinuity
is allowed at a cliff; no physical surface continuity is assumed there.

## Explicit prototype assumptions

The source photo supplies approximate horizontal traces only. A 4 m ridge,
6 m cliff step, 0.8 m channel depth, and 2 m bank shoulder are synthetic editable
parameters in `icelandPrototype`, not measurements. For escarpments the left
side of an authored line is provisionally high; `highSide: right` reverses it.
Probable water from the fixture is displayed as present for the example; it
is not independently verified.

Features apply in ascending priority: default relief features 20, vegetation
patches 30, exposed slopes 40, channels 60, pools 70. `properties.priority`
overrides a feature's default. Equal priorities use stable ID ordering. Heights
from features combine additively; surface values use the ordered patches.
Persistent edits apply last and can override surface values and add a height
offset. Production authoring should expose priorities and resolve conflicts
explicitly rather than rely on ID ordering.

## Boundaries and limitations

The generator returns cell-center samples for one-meter-edge base hexagons;
it also supports arbitrary-point samples. The renderer additionally draws
continuous watercourse traces, so sub-cell-width channels remain visible.
Cell-center sampling does not yet provide area coverage fractions or exact
collision geometry. The pixel map clips by cell-center selection, so the visible
viewport boundary is slightly jagged.

The fixture's broad background defaults are represented by the shared prototype;
this example does not implement sparse-region inheritance, spatial database
queries, or automatic prototype selection. It evaluates all features in memory.
The tentative break-of-slope and gully traces are not given synthetic relief yet.
Wetness outside explicit water remains unspecified. It does not simulate water
flow, erosion, seasonal changes, or water-surface elevation. Finite cliff fields
are illustrative local steps, not geological reconstruction; intersecting cliff
systems and sharp bends need additional authoring rules before production use.

Generated data is bounded to 100,000 cells per viewport and coordinates within
100 million meters. No full world tree or generated-cell database is created.

## Validation

Tests cover overlap/request-order determinism, feature ordering independence,
channel versus water state, ridge and cliff profiles, closed-loop relative
height consistency, persistent edit precedence, seed variation, and invalid
requests. The full existing prototype suite also runs unchanged.

## Wetland extension

The second example adds polygon pond basins with smoothly tapered synthetic
depths and saturated outside margins; an explicit wet-ground patch; and tree
stands that produce separate situated objects. Tree crowns/heights do not alter
the terrain height field. Object placement shares coordinate-based determinism.
The common renderer adapts to viewport aspect ratio and overlays trees only on
the surface panel. See `wetland-terrain-test.md` and `prototype:wetland`.
