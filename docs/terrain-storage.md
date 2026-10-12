# Terrain persistence

PostgreSQL with PostGIS stores sparse terrain specifications, spatial features,
and persistent exceptions. Prisma 7.8.0 manages the schema and migrations.
Each table has its own file in `prisma/schema`; `schema.prisma` contains the
datasource. No runtime database client or terrain generator is introduced yet.

## Commands

Use Node 24+ and `npm ci`. Supply DATABASE_URL through the environment; the CLI
does not automatically load `.env`. For example, use Node's `--env-file` option
or your deployment environment. `.env.example` illustrates the URL only.

- `npm run db:validate`: validate all schema files without a database.
- `npm run db:format`: format all schema files.
- `npm run db:migrate -- --name description`: create/review development migrations.
- `npm run db:deploy`: apply committed migrations to the configured database.
- `npm run db:status`: inspect migration status.

The PostgreSQL server must have PostGIS installed, and the migration role must
be permitted to create the extension. Development shadow databases need it too.
The initial migration enables PostGIS before creating geometry columns.
Do not use `prisma db push` as a replacement for migrations: SQL migrations
also maintain spatial indexes and CHECK constraints not expressed in Prisma.

## Tables

| Model | Table | Purpose |
| --- | --- | --- |
| World | world | Grid definition and one-meter base hex edge default |
| TerrainGenerator | terrain_generator | Versioned implementation reference and parameters |
| TerrainRegion | terrain_region | Explicit cell specifications and inherited defaults |
| TerrainFeature | terrain_feature | Spatial features, properties, and current state |
| TerrainOverride | terrain_override | Persistent local terrain patches |
| TerrainBoundary | terrain_boundary | Authored approaches and transitions |

All geometries are two-dimensional, SRID 0. The application defines coordinate
units as meters; SRID 0 does not enforce units. Absolute elevation is omitted.
Geometry types are represented with Prisma `Unsupported`, so spatial reads and
writes require parameterized SQL (for example ST_GeomFromText and ST_AsGeoJSON).
Required unsupported columns also restrict generated model CRUD support.
IDs use Prisma-side UUID defaults; raw SQL inserts must supply UUIDs explicitly.

Spatial GiST indexes cover region footprints, feature influence footprints,
override footprints, and boundary geometry. Always filter by world_id as well
as spatial intersection: different worlds can share coordinate values.
Feature geometry and its influence footprint must be changed in one transaction.

## Sparse hierarchy

A missing cell record means derive from ancestor defaults, not unknown terrain.
`parentId` references the nearest explicitly stored ancestor in the same world.
`childSlot` describes the slot in the immediate geometric parent, which may not
have a stored row. Consequently `(parentId, childSlot)` is NOT unique.
`(worldId, cellAddress)` is unique. Ancestor containment, level ordering, and
cycle prevention beyond self-parenting require application validation once the
addressing scheme is defined.

Boundary addresses do not require stored region rows. Canonicalize A/B by
bytewise address ordering; when swapping them, swap approaches and reverse
any directional transition. Feature references are constrained to the same world.
Routine adjacency and parent-side summaries are derived, not stored.

Generator versions must remain immutable once referenced. JSON structures,
inheritance/override precedence, cell addressing, and generator behavior remain
design questions; this migration intentionally does not choose them.
No database migration is applied merely by installing these files.
