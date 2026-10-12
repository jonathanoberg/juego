-- PostGIS must be installed on the PostgreSQL server, including shadow databases.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "terrain_boundary" (
    "id" UUID NOT NULL,
    "world_id" UUID NOT NULL,
    "cell_a_address" TEXT NOT NULL,
    "cell_b_address" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "geometry" geometry(MultiLineString, 0) NOT NULL,
    "approach_a" JSONB NOT NULL DEFAULT '{}',
    "approach_b" JSONB NOT NULL DEFAULT '{}',
    "transition" JSONB NOT NULL DEFAULT '{}',
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "feature_id" UUID,
    "revision" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "terrain_boundary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terrain_feature" (
    "id" UUID NOT NULL,
    "world_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "geometry" geometry(Geometry, 0) NOT NULL,
    "influence_footprint" geometry(MultiPolygon, 0) NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "state" JSONB NOT NULL DEFAULT '{}',
    "revision" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "terrain_feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terrain_generator" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "implementation_key" TEXT NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "terrain_generator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terrain_override" (
    "id" UUID NOT NULL,
    "world_id" UUID NOT NULL,
    "footprint" geometry(MultiPolygon, 0) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "surface_patch" JSONB NOT NULL DEFAULT '{}',
    "relief_patch" JSONB NOT NULL DEFAULT '{}',
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "cause" TEXT,
    "revision" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "terrain_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terrain_region" (
    "id" UUID NOT NULL,
    "world_id" UUID NOT NULL,
    "parent_id" UUID,
    "cell_address" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "child_slot" SMALLINT,
    "name" TEXT,
    "terrain_label" TEXT,
    "footprint" geometry(MultiPolygon, 0) NOT NULL,
    "surface_defaults" JSONB NOT NULL DEFAULT '{}',
    "relief_defaults" JSONB NOT NULL DEFAULT '{}',
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "generator_id" UUID,
    "generation_seed" BIGINT,
    "generation_params" JSONB NOT NULL DEFAULT '{}',
    "revision" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "terrain_region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "base_hex_edge_m" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "grid_definition" JSONB NOT NULL,

    CONSTRAINT "world_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terrain_boundary_world_id_level_cell_a_address_cell_b_addre_key" ON "terrain_boundary"("world_id", "level", "cell_a_address", "cell_b_address");

-- CreateIndex
CREATE INDEX "terrain_feature_world_id_kind_idx" ON "terrain_feature"("world_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "terrain_feature_world_id_id_key" ON "terrain_feature"("world_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "terrain_generator_name_version_key" ON "terrain_generator"("name", "version");

-- CreateIndex
CREATE INDEX "terrain_region_parent_id_idx" ON "terrain_region"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "terrain_region_world_id_id_key" ON "terrain_region"("world_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "terrain_region_world_id_cell_address_key" ON "terrain_region"("world_id", "cell_address");

-- AddForeignKey
ALTER TABLE "terrain_boundary" ADD CONSTRAINT "terrain_boundary_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "world"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terrain_boundary" ADD CONSTRAINT "terrain_boundary_world_id_feature_id_fkey" FOREIGN KEY ("world_id", "feature_id") REFERENCES "terrain_feature"("world_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "terrain_feature" ADD CONSTRAINT "terrain_feature_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "world"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terrain_override" ADD CONSTRAINT "terrain_override_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "world"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terrain_region" ADD CONSTRAINT "terrain_region_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "world"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terrain_region" ADD CONSTRAINT "terrain_region_world_id_parent_id_fkey" FOREIGN KEY ("world_id", "parent_id") REFERENCES "terrain_region"("world_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "terrain_region" ADD CONSTRAINT "terrain_region_generator_id_fkey" FOREIGN KEY ("generator_id") REFERENCES "terrain_generator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Spatial indexes and CHECK constraints are maintained in SQL migrations.
CREATE INDEX terrain_region_spatial_idx ON terrain_region USING gist (footprint);
CREATE INDEX terrain_feature_spatial_idx ON terrain_feature USING gist (influence_footprint);
CREATE INDEX terrain_override_spatial_idx ON terrain_override USING gist (footprint);
CREATE INDEX terrain_boundary_spatial_idx ON terrain_boundary USING gist (geometry);
CREATE INDEX terrain_override_world_id_idx ON terrain_override (world_id);
CREATE INDEX terrain_boundary_world_id_feature_id_idx ON terrain_boundary (world_id, feature_id);

ALTER TABLE world ADD CONSTRAINT world_base_hex_edge_positive
  CHECK (base_hex_edge_m > 0 AND base_hex_edge_m < 'Infinity'::float8);
ALTER TABLE terrain_generator ADD CONSTRAINT terrain_generator_version_positive CHECK (version > 0);
ALTER TABLE terrain_region ADD CONSTRAINT terrain_region_level_nonnegative CHECK (level >= 0);
ALTER TABLE terrain_region ADD CONSTRAINT terrain_region_child_slot_range CHECK (child_slot BETWEEN 0 AND 6);
ALTER TABLE terrain_region ADD CONSTRAINT terrain_region_parent_slot CHECK (parent_id IS NULL OR child_slot IS NOT NULL);
ALTER TABLE terrain_region ADD CONSTRAINT terrain_region_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id);
ALTER TABLE terrain_boundary ADD CONSTRAINT terrain_boundary_level_nonnegative CHECK (level >= 0);
-- Bytewise canonical ordering prevents duplicate reversed pairs.
ALTER TABLE terrain_boundary ADD CONSTRAINT terrain_boundary_canonical_pair
  CHECK (cell_a_address COLLATE "C" < cell_b_address COLLATE "C");
