# Planar seven-cell aggregation prototype

Run `npm run prototype:hex`. Optionally pass a scratch SVG destination:
`npm run prototype:hex -- /tmp/hex-aggregation.svg`.
Run checks with `node --test prototyping/hex-grid.test.ts`.

## Convention

Axial coordinates (q,r) use basis vectors 60 degrees apart. Level zero consists
of regular hexagons with one-meter edges. Its centers in meters are
`x = 1.5q`, `y = sqrt(3)/2 * (q + 2r)`.

Child slot offsets, in fixed order, are:
`(0,0), (1,0), (0,1), (-1,1), (-1,0), (0,-1), (1,-1)`.
Slots are relative to the grid at that level, not fixed compass labels.

For a parent at level L, its child center coordinates are
`M * (parent.q, parent.r) + slotOffset`, using M+ when L-1 is even
and M- when L-1 is odd:

```
M+ = [[2,-1],[1,3]]
M- = [[3,1],[-1,2]]
```

Both determinants are seven, and both ordered products are 7I. Each transform
scales center spacing by sqrt(7) and rotates it by approximately ±19.1066°.
Two levels therefore restore orientation and scale spacing by seven.

## Why ownership is unique everywhere

For M+, the quotient class of a child is `(3q+r) mod 7`. The seven slot
offsets produce all seven distinct residues. For M-, use `(2q-r) mod 7`,
which also produces all seven residues. Thus exactly one slot makes the inverse
transform integral, including at negative coordinates. The remaining inverse
coordinate is then integral too. This proves the partition beyond sampled tests.
Recursion preserves unique base-cell ownership at every level.

Exact parent footprints are unions of constituent base hexagons. Coarse regular
hexagons are only display approximations. Tests check reverse addressing,
nonoverlap, complete coverage of a fine-grid window, connectivity, a single
closed boundary (no holes), and area `7^L * 3sqrt(3)/2` for sampled footprints.
The demo finds six physically touching aggregates at levels zero through four;
we do not assume arbitrary alternate partitions have this property.

This prototype enumerates base cells only for verification and diagrams, with
an explicit level-five limit. Production lookups should use integer addressing
and spatial queries, not recursive enumeration. Safe-integer overflow is rejected;
arbitrary-precision coordinates and production limits remain future work.
The prototype does not implement terrain generation, PostGIS persistence, or
cave portals. World identity will scope addresses outside this geometry module.

## Generated terrain policy

Designers may refine generators and terrain prototypes. A seed reproduces the
terrain under the current rules, not necessarily earlier revisions. Explicit
features and persistent edits remain authoritative; cache keys must include
rule/prototype revisions. Revision changes do not require storing all generated
terrain or permanently pinning regions to old rules.
