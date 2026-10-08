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
- `prototyping/behaviors.ts`: individual condition, contribution, and lifetime modules.
- `prototyping/engine.ts`: deliberately limited in-memory evaluator and inventory/equipment actions.
- `prototyping/scenario.test.ts`: requested interaction sequence plus expiration, equipment, and consumption checks.

Entities are world instances; definitions are reusable templates. Entity component values override definition defaults at the whole-component level. Effective attributes are calculated without changing base attributes. Behavior code is referenced by ID and version in JSON rather than embedded as source strings.

## Prototype rules and limits

Alice starts with strength 10 and intelligence 12. The worn ring multiplies strength by 1.10 when effective intelligence is at least 13. Reading one scroll consumes it and multiplies intelligence by 1.10 for 300 simulation seconds. The other scroll remains in inventory. Equipped items still belong to inventory. Fractional values are retained (JavaScript floating point); tests compare non-integer values with tolerance.

Only multiplicative attribute contributions, all-of conditions, finger/body equipment slots, and fixed-duration lifetimes are implemented. Multiple multipliers compound. Attribute dependencies are resolved on demand; cycles throw rather than iterate to a fixed point. Effect sources can refer to consumed entities for provenance. Expired effects remain recorded but contribute nothing.

The core includes action interfaces; prototype equip/read methods currently perform validated in-memory mutations directly. A behavior registry, full JSON Schema validation, generic action transaction executor, event-driven lifetimes, stacking policies, multiplayer concurrency, persistence, and sandboxing remain open design work. Parameter schemas in prototype modules are placeholders; the evaluator checks the parameters it uses.

## Classes and progression

Classes and spells are ordinary reusable definitions with typed `class` and `spell` components. Characters reference classes through a `progression` component; this does not replace their entity definition. The array of class tracks leaves room for multiclassing, but its balance rules are undecided.

Alice is an illustrative level-3 Sword Wizard. Her class offers Light (level 1), Enchanted Blade (level 2), Ward (level 3, requires Light), and Flame (level 5). She has selected Light and Enchanted Blade. Each selection records the class level and world time at learning, plus an independent mastery rank. Class progression records achieved levels and their times. Learning eligibility is derived from the class definition and current progression rather than saved as a second mutable list.

The class references a versioned armor-category condition: robes are permitted, plate is rejected. Rings are unaffected by this armor rule. Alice owns a robe and plate armor for the prototype checks; equipment uses separate finger/body slots. Failed equipment or learning actions leave state unchanged.

All spell names, level gates, starting choices, maximum level, and mastery ranks are sample content. Spell casting, mastery advancement, experience points, level costs, spell-choice budgets, respecialization, and multiclass conflict rules remain open. `advanceClassLevel` is a prototype/admin operation, not a player-facing progression economy. For now every class equipment rule must pass; this is only a provisional multiclass policy. Class rules are checked on equip; changing classes or class definitions would need equipment revalidation. No full schema validation has been introduced.
