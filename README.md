# Juego

Initial TypeScript scaffold for a multiplayer RPG with presentation-independent gameplay.

Architecture decisions: [docs/architecture-decisions.md](docs/architecture-decisions.md).

## Run

Node.js 24 or newer is required. The prototype and tests run directly through Node's TypeScript stripping, without installing dependencies:

```sh
npm test
npm run prototype
```

For static type checking, install development dependencies and run `npm run typecheck`.

## Layout

- `core/game/`: reusable model and behavior interfaces; no persistence or evaluator.
- `prototyping/fixtures/world.json`: Alice, a ring, two scrolls, content definitions, and effect definitions/instances.
- `prototyping/behaviors.ts`: individual predicate, contribution, and lifetime modules.
- `prototyping/engine.ts`: deliberately limited in-memory evaluator and inventory/equipment actions.
- `prototyping/scenario.test.ts`: requested interaction sequence plus expiration, equipment, and consumption checks.

Entities are world instances; definitions are reusable templates. Entity component values override definition defaults at the whole-component level. Effective attributes are calculated without changing base attributes. Behavior code is referenced by ID and version in JSON rather than embedded as source strings.

## Prototype rules and limits

Alice starts with strength 10 and intelligence 12. The worn ring multiplies strength by 1.10 when effective intelligence is at least 13. Reading one scroll consumes it and multiplies intelligence by 1.10 for 300 simulation seconds. The other scroll remains in inventory. Equipped items still belong to inventory. Fractional values are retained (JavaScript floating point); tests compare non-integer values with tolerance.

Multiplicative attribute and descriptive contributions, all-of predicates, finger/body equipment slots, and fixed-duration lifetimes are implemented. Multiple multipliers compound. Attribute dependencies are resolved on demand; cycles throw rather than iterate to a fixed point. Effect sources can refer to consumed entities for provenance. Expired effects remain recorded but contribute nothing.

The core includes action interfaces; prototype equip/read methods currently perform validated in-memory mutations directly. A behavior registry, full JSON Schema validation, a full action transaction executor, event-driven lifetimes, stacking policies, multiplayer concurrency, persistence, and sandboxing remain open design work. Parameter schemas in prototype modules are placeholders; the evaluator checks the parameters it uses.

## Classes and progression

Classes and spells are ordinary reusable definitions with typed `class` and `spell` components. Characters reference classes through a `progression` component; this does not replace their entity definition. The array of class tracks leaves room for multiclassing, but its balance rules are undecided.

Alice is an illustrative level-3 Sword Wizard. Her class offers Light (level 1), Enchanted Blade (level 2), Ward (level 3, requires Light), and Flame (level 5). She has selected Light and Enchanted Blade. Each selection records the class level and world time at learning, plus an independent mastery rank. Class progression records achieved levels and their times. Learning eligibility is derived from the class definition and current progression rather than saved as a second mutable list.

The class references a versioned armor-category condition: robes are permitted, plate is rejected. Rings are unaffected by this armor rule. Alice owns a robe and plate armor for the prototype checks; equipment uses separate finger/body slots. Failed equipment or learning actions leave state unchanged.

All spell names, level gates, starting choices, maximum level, and mastery ranks are sample content. Spell casting, mastery advancement, experience points, level costs, spell-choice budgets, respecialization, and multiclass conflict rules remain open. `advanceClassLevel` is a prototype/admin operation, not a player-facing progression economy. For now every class equipment rule must pass; this is only a provisional multiclass policy. Class rules are checked on equip; changing classes or class definitions would need equipment revalidation. No full schema validation has been introduced.

## Persistent status effects

Run `npm run prototype:status` for deterministic spill and no-spill demonstrations. `prototyping/fixtures/status.json` extends the original world with hunger, stew, soap, and a washable stain. The base ring-and-scroll fixture remains independent.

Applicability checks are now named predicates (`PredicateBehavior`, effect `predicates`), separating them from entity statuses. Hunger and stains use ordinary effect instances. Description contributions produce current text; item definitions and base entity components are not rewritten. `effectsOn` returns active detached snapshots; `effectDefinition` exposes tags used by actions.

Eating and cleaning are action modules returning structured world changes. A small staged executor applies consume-item, attach-effect, and remove-effect operations together. Existing scroll and equipment methods remain direct validated prototype actions. Eating satisfies hunger, consumes one stew, and may stain worn body equipment. Cleaning matches both `stain` and `washable`, removes matching instances, and consumes one soap only on success. Other effects remain intact. Effects without lifetimes persist until removed, even after unequipping.

The engine supplies randomness; samples must be finite and in [0, 1). Spill occurs when the sample is below the content-defined probability (sample stew: 25%). Without body equipment there is no spill target and no random draw. Tests inject draws; default engine randomness uses Math.random. Full deterministic replay and random-generator rollback are not implemented. Nutrition quantity, repeated stain severity, garment material sensitivity, washing costs, and localization are still open. Description fragments are deduplicated for presentation, while effect instances remain separate.

## Containers and placement

Run `npm run prototype:inventory` for a scabbard/pockets demonstration. `prototyping/fixtures/inventory.json` extends the original fixture with a worn-capable scabbard, backpack, pouch, swords, coins, book, anvil, car, and wild fox. The robes gain two pockets in this scenario only.

`core/game/inventory.ts` defines physical properties, compartments, placements, and admission contracts. `prototyping/container-rules.ts` supplies versioned count, tag, size-budget, length, and burden predicates. `prototyping/inventory.ts` stages movements and validates compartments and cycles before the engine swaps state.

Each pocket admits one small item or two extra-small items. The scabbard admits one sword with a known length strictly below one meter. The backpack admits at most ten direct entities, requires portable items, rejects living items, and has independent size/burden budgets. Type checks apply to direct contents; policy for classifying nested living contents is deferred. Size checks use the external size of nested containers; burden includes their own weight and all contents. Sample burden points (1/3/30) are game units, not kilograms. Unknown size, length, or weight is rejected when required by a rule.

Placement is authoritative; equipment is a compatibility projection. Existing fixtures without placements are migrated from equipment/ownership at construction. `moveItem` handles non-equipment moves; `equip` retains class restrictions and places equipped items consistently. Moving a worn container clears its equipment slot while its contents stay inside. `inventory` still lists owned entities; `carriedInventory` traverses physical containment and records each item's immediate placement. `directContents` lists only a container's immediate contents.

Ownership is the current manipulation permission; proximity, accessibility through locked containers, shared permission, stacking, worn-container ergonomics, character burden capacity, exact mass evaluation, and deletion of nonempty containers remain future work. Moves currently revalidate every compartment, which is acceptable for this prototype. Existing eat/clean/scroll actions are leaf-item demonstrations; a general deletion policy for loaded containers is not yet implemented.
