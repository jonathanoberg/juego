# Gradient Life Lab

An exploratory 20×20 cellular ecosystem: local directional signals, slime-mold-like connected plant networks, diffusing nutrients, mobile grazers, and probabilistic animal division. This is a behavioral experiment, not a biologically validated model or a learning agent.

Live private sandbox: https://gradient-life-lab.jonathanoberg.chatgpt.site

## Run and verify

No dependencies or build step. Serve the `public` directory over HTTP, for example:

```sh
cd projects/gradient-life-lab
python3 -m http.server 8000 --directory public
```

Open http://localhost:8000. Node.js 24 matches the parent repository runtime:

```sh
npm test
```

Tests cover nutrient conservation during diffusion, disabling diffusion, network nutrient sharing, thread extension and splitting, division timing and daughter identity/size/energy, blocked births, disabling division, starvation reset, crowd-triggered escape and blocked paths, deterministic replay, and capacity bounds over simulated runs. Browser interaction has not been automated or visually verified.

## Model and current defaults

- Cells share an 11-unit capacity across food (0–10), plant mass (0–10), and at most one animal (size 1–10). Quantities are fractional. Edges do not wrap.
- Start with 32 food cells at 10, 12 plant cells at 1 rooted in food, and seven size-1 animals with energy 3. Default seed: 42.
- Eight directional signals sum quantity divided by distance within radius 5, excluding the observing cell. Signals convey information; they do not move nutrients.
- Food diffuses between orthogonal neighbors down concentration differences, at default rate 0.08 divided among four directions. Snapshot transfers conserve food and respect capacity.
- Food renewal independently adds up to 0.01 per cell per tick, subject to capacity. Zero disables external replenishment.
- Touching plant cells, including diagonal contacts, form one nutrient-sharing network. Networks merge on contact and split when connections vanish. Sharing is instantaneous and has no distance cost or persistent organism identity.
- Maintenance costs 0.01 food per unit of plant mass per tick. Underfed cells start withering by 0.15 after six grace ticks. Fed cells grow by up to 0.35 per tick using food anywhere in their network.
- Fed networks of mass at least 1.5 can transfer 0.2 existing biomass into one new thread cell per tick, favoring food plus its directional signal. The network supports the tip across empty cells.
- Animals eat up to 0.15 × size from the richest plant cell within their own cell or eight neighbors. Energy upkeep is 0.04 × size. Energy above 2 + size allows growth of up to 0.25, bounded by size 10 and available capacity. Starving animals shrink by 0.25, then die at size 1.
- Animals without a meal move toward plants and directional plant signals, wandering on ties, only where they fit.
- Crowding overrides feeding at five occupied adjacent cells (count, not animal mass), using the start-of-tick animal snapshot. An escape searches passable paths of up to three adjacent steps, ranking fewer neighbors, lower animal signal, then plant availability. Every path cell must fit the animal; it cannot jump obstacles. If no less crowded destination exists, ordinary feeding continues. Escape permits feeding at the destination but no second ordinary move, and has no extra energy cost. Threshold 9 disables it. Threshold and distance are adjustable; the UI counts escape events.
- After five full ticks at size 10, an animal has a 10% chance per eligible tick to divide when an adjacent cell can accommodate a daughter. It becomes two new animals, each size 3 with 30% of its stored energy. The remaining 40% is lost as division cost, not recycled. Daughters first act the next tick. Shrinking resets the waiting period.
- Each tick diffuses food, computes signals, resolves network actions then animal actions in seeded shuffled order, and finally renews food. This is a phased update with reproducible conflict resolution, not fully simultaneous action resolution.

## Outcomes and limitations

Earlier versions collapsed because independently seeded plants lacked access to food. Rooting plants in food, sharing nutrients through threads, diffusion, and renewal were added incrementally. The user observed persistent plant networks and animals with renewal 0.01 before division was added.

Before crowd avoidance was added, with division enabled, default seed 42 produced nine divisions and then lost all plants and animals by tick 350 in a checked run. No equilibrium is guaranteed. Residual food cannot restart extinct plants; there is no germination, predation, aging, nutrient recycling, genetics, learning, memory, or transport delay. The UI exposes ecological rates for experiments rather than forcing survival.

## Source and publication

This folder is the canonical source. `public/` contains the exact application assets deployed when this folder was introduced. Tests live in `tests/`.

For future edits, change these files first, run tests, and commit/push to juego. Then copy the application into the existing Site checkout:

```sh
npm run sync-site -- /workspace/sites/gradient-life-lab
```

The script verifies the Site identity before copying. Package and publish through the Sites skill afterward; it manages its own source repository. Never copy credentials or deployment archives into juego. Keep this README synchronized with rule/default changes.
