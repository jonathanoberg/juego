# Juego

Initial TypeScript scaffold for a multiplayer RPG with presentation-independent gameplay.

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

Only multiplicative attribute contributions, all-of conditions, one finger slot, and fixed-duration lifetimes are implemented. Multiple multipliers compound. Attribute dependencies are resolved on demand; cycles throw rather than iterate to a fixed point. Effect sources can refer to consumed entities for provenance. Expired effects remain recorded but contribute nothing.

The core includes action interfaces; prototype equip/read methods currently perform validated in-memory mutations directly. A behavior registry, full JSON Schema validation, generic action transaction executor, event-driven lifetimes, stacking policies, multiplayer concurrency, persistence, and sandboxing remain open design work. Parameter schemas in prototype modules are placeholders; the evaluator checks the parameters it uses.
