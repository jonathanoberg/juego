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

- Cells share an 11-unit capacity across food (0–10), plant mass (0–10), and at most one animal (size 1–10). Quantities are fractional. Edges do not wrap. Plants and diffusion remain bounded; animal movement can leave the world.
- Start with 32 food cells at 10, 12 plant cells at 1 rooted in food, and seven size-1 animals with energy 3. Default seed: 42.
- Eight directional signals sum quantity divided by distance within radius 10, excluding the observing cell. Signals convey information; they do not move nutrients.
- Food diffuses between orthogonal neighbors down concentration differences, at default rate 0.08 divided among four directions. Snapshot transfers conserve food and respect capacity.
- Food renewal independently adds up to 0.01 per cell per tick, subject to capacity. Zero disables external replenishment.
- Touching plant cells, including diagonal contacts, form one nutrient-sharing network. Networks merge on contact and split when connections vanish. Sharing is instantaneous and has no distance cost or persistent organism identity.
- Maintenance costs 0.01 food per unit of plant mass per tick. Underfed cells start withering by 0.15 after six grace ticks. Fed cells grow by up to 0.5 per tick using food anywhere in their network.
- Fed networks of mass at least 1.5 can transfer 0.2 existing biomass into one new thread cell per tick, favoring food plus its directional signal. The network supports the tip across empty cells.
- Grazing adds a local damage trace equal to consumed plant mass, capped at 10. It retains 80% per tick and affects the next tick’s plant extension. Candidate growth scores subtract 6 × inverse-distance damage potential within the signal radius from food attraction, including damage in the destination cell. Damage remains after a cell is eaten out. Weight zero disables avoidance. The UI exposes its weight, red damage outlines, and directional damage signals. This models a response to damage, not subjective pain.
- Animals eat up to 0.15 × size from the richest plant cell within their own cell or eight neighbors. Energy upkeep is 0.04 × size. Energy above 2 + size allows growth of up to 0.25, bounded by size 10 and available capacity. Starving animals shrink by 0.25, then die at size 1.
- Animals without a meal move toward plants and directional plant signals, wandering on ties, only where they fit.
- Crowding overrides feeding at five occupied adjacent cells (count, not animal mass), using the start-of-tick animal snapshot. An escape searches passable paths of up to three adjacent steps, ranking fewer neighbors, lower animal signal, then plant availability. Every path cell must fit the animal; it cannot jump obstacles. If no less crowded destination exists, ordinary feeding continues. Escape permits feeding at the destination but no second ordinary move, and has no extra energy cost. Threshold 9 disables it. Threshold and distance are adjustable; the UI counts escape events.
- Animals age once per tick, stop dividing at age 150, and begin decline at age 220 (never before the reproductive cutoff). Decline has a 25% per-tick chance to subtract 0.25 size; below size 1 the animal dies. Declining animals can feed and move but cannot grow back. Daughters start at age zero. Timings, probability, and decrement are adjustable; probability zero disables age-related shrinking. No mass recycling. The inspector shows age/life stage and the header counts age deaths.
- After five full ticks at size 10, an animal has a 10% chance per eligible tick to divide when an adjacent cell can accommodate a daughter. It becomes two new animals, each size 3 with 30% of its stored energy. The remaining 40% is lost as division cost, not recycled. Daughters first act the next tick. Shrinking resets the waiting period.
- Animal escape can cross an edge if a passable path reaches one and steps remain to cross. Outside is an unpopulated escape destination. Departed animals are removed immediately, with no feeding, division, corpse, or nutrient return. Ordinary movement may also leave from an edge when no visible food offers a better destination. Merely standing on an edge is safe. The header counts departures separately from age deaths.
- Each tick diffuses food, computes signals, resolves network actions then animal actions in seeded shuffled order, and finally renews food. This is a phased update with reproducible conflict resolution, not fully simultaneous action resolution.

## Outcomes and limitations

Earlier versions collapsed because independently seeded plants lacked access to food. Rooting plants in food, sharing nutrients through threads, diffusion, and renewal were added incrementally. The user observed persistent plant networks and animals with renewal 0.01 before division was added.

Historical defaults before crowd avoidance was added: with division enabled, default seed 42 produced nine divisions and then lost all plants and animals by tick 350 in a checked run. No equilibrium is guaranteed. Residual food cannot restart extinct plants; there is no predation, nutrient recycling, genetics, learning, memory, or transport delay. The UI exposes ecological rates for experiments rather than forcing survival.

## Source and publication

This folder is the canonical source. `public/` contains the exact application assets deployed when this folder was introduced. Tests live in `tests/`.

For future edits, change these files first, run tests, and commit/push to juego. Then copy the application into the existing Site checkout:

```sh
npm run sync-site -- /workspace/sites/gradient-life-lab
```

The script verifies the Site identity before copying. Package and publish through the Sites skill afterward; it manages its own source repository. Never copy credentials or deployment archives into juego. Keep this README synchronized with rule/default changes.

The current experimental defaults (radius 10, plant growth 0.5, crowding threshold 5, escape distance 3) follow the user’s observation of interesting equilibria. That observation is not a guarantee across seeds or after damage avoidance.

## Persistent spores

Plant nutrient networks still use all eight neighboring directions. Sporation specifically requires the same fully occupied 2×2 square: four side connections plus both diagonals (six pairwise connections). A square must be present for two qualifying end-of-tick observations; on the third it can replace one of its four cells with a spore. Missing any corner resets that square’s timer. Four-cell chains, L shapes, and diagonal strings do not qualify. Squares do not wrap across board edges.

The selected corner must contain at least 1 plant mass, replaced entirely with a 1-unit spore; excess mass is lost. At most one spore per connected network is produced per tick. Success resets every square timer in that network, so other overlapping or distant squares in the same organism cannot produce another spore immediately. Squares in separate networks maintain independent timers.

Spores persist indefinitely, cannot be eaten, consume no food, and block plant extension into their cell. They count toward capacity; animals can share or cross their cell only when they fit. Food diffuses normally through remaining capacity. Germination checks a shared snapshot after diffusion and before growth: food must exist in the spore’s cell, that cell must have no animal, and all eight in-bounds neighbors must contain no plant or animal. Food-bearing cells count as empty of organisms; the exterior counts as empty. Germination converts the spore’s 1 unit into a size-1 plant without creating mass. The new plant then uses the ordinary food/growth rules. The UI shows spores as purple diamonds and counts germinations.

## Genetics, run configuration, and mating

All simulation controls are captured at reset, including environment, mutation settings, and founder traits. Editing controls during a run only sets up the next reset. Playback speed is live and changes wall-clock pacing only. Run options and genomes are immutable copies.

Plant genes: sensing radius, growth rate, starvation grace, damage avoidance. Animal genes: sensing radius, metabolism, mitosis wait/probability, crowd threshold, escape distance, reproductive cutoff, decline age/probability/amount, mating probability and gestation ticks. Founders receive the configured values. A plant organism has a stable ID/genome across its growing threads; touching organisms share nutrients without merging ancestry. A fragmented organism retains its ancestry/genome.

The four cells of a qualifying spore square can come from multiple plant parents. For each child attribute, pick uniformly among DISTINCT contributing parents (not weighted by occupied cell count), then independently apply plant mutation probability. For a single-parent spore the child is clonal before mutation. The parent arrangement in the square must remain unchanged while its maturity timer runs. Spore genes and all parent IDs are stored at spore creation and retained through germination. Mitosis independently clones/mutates each daughter's genome. Sexual offspring independently pick each attribute from either parent's genome, then mutate. Defaults: 5% mutation chance per attribute for each species, with a ±10% change. Discrete traits use symmetric steps of at least one; fractions may round to a different effective percentage. Traits are bounded to model ranges; decline age is constrained to be no earlier than reproductive cutoff. Zero-valued continuous traits remain zero under percentage mutation. Mutation settings are run parameters, not genes.

Opposite-gender animals, each size >=4 and younger than their own reproductive cutoff, must be adjacent on two consecutive tick observations. Their pairing probability is the mean of their inherited mating probabilities (default 10% per eligible tick). Pairing precedes mitosis and stops BOTH animals from moving while they continue feeding, metabolizing, and aging. Gestation uses the longer parental duration (default 5 ticks). At completion, 1–2 independently inherited/mutated size-1 offspring are placed next to either parent, preferring cells without plants; plant cells can be used when capacity allows. Spores block birth placement. Each newborn receives energy 1, transferred as 0.5 from each parent; birth waits for space and energy. Partially placed litters finish when remaining spaces/energy become available. Death of a partner cancels remaining births and releases the survivor. Age cutoff is checked at conception; an existing gestation can finish afterward if both parents remain alive. Newborn age is zero, with no actions on its birth tick. Gender is assigned independently at birth. Parents may resume movement after the last birth.

Animal gender is shown by color; a yellow outline means gestating. The inspector shows genome, generation and parent IDs for animals, plants and spores. It also lists a spore's germination blockers. Food at maximum concentration in ALL surrounding cells is explicitly tested to allow germination: only plants and animals block the surrounding-cell condition, and food must exist in the spore's OWN cell.

Earlier rule descriptions above describe the initial common traits; the actual behavior now reads each organism's inherited values. Environmental renewal, diffusion and damage-trace decay remain shared, fixed for the run. Current behavior has not been validated as a biological model or a stable ecology.

Verification for genetics/mating additionally covers frozen controls and pending UI settings in a DOM harness, independent crossover, mutation bounds and direction, multiple plant parents, genotype-specific growth/crowding, mating eligibility/contact reset, stationary gestation, newborn age, empty/plant-space birth placement, blocked births, and partner death. Browser interaction remains unverified.

Adjacent dormant spores do not block germination. The germination pass uses one shared snapshot, so neighboring spores with food can germinate simultaneously before either new plant can block the other. The inspector counts neighboring spores for information, but does not list them as blockers.
