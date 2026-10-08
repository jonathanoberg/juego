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

## Sword combat and armor

Run `npm run prototype:combat`. The combat fixture extends the inventory world with sword mechanics, a fire-susceptible training creature, a shield, plate, and robes. Alice's sword skill and the creature's dodge skill start at 5. Weapon damage is an inclusive 1–8 roll of slicing damage.

Armor now has independent `reduceHit` (probability points) and `reduceDamage` (flat damage points). Sample robes provide 0/1, plate 0/6, and a shield 0.30/0. Hit chance is `clamp(0.75 + 0.02 * (weapon skill - dodge) - summed reduceHit, 0.05, 0.95)`. A hit occurs when the supplied random draw is strictly below that chance. A second draw rolls damage only on a hit. Damage is `max(0, rolled damage * multipliers - summed reduceDamage)`; health cannot fall below zero. These are provisional balance choices. Defense currently reads base equipped-item values; defense enchantment contributions remain future work.

Attack input explicitly identifies actor, weapon, and defender. An owned weapon must be equipped in hand, and both participants must have positive health. Attack outcomes distinguish misses from action rejection and report rolls, probabilities, reduction, multiplier, damage, and type. `applyDamage` changes use the staged executor. The weapon references its versioned attack behavior; effect definitions may supply separate `attackContributions` evaluated against the actual defender.

Alice can learn Flame at class level 5 and activate it on her held sword. Activation is currently a validated prototype method, not a generic spellcasting executor. Its effect lasts 60 simulation seconds, adds "wreathed in flame," and doubles damage against a `susceptible-to-fire` trait. Damage remains slicing. Multiplication happens before armor subtraction. Active flame cannot be applied again; expired flame has no descriptive or combat contribution. Spell resource costs, range, turn economy, criticals, typed damage packets, and gathering attack modifiers from actors/defenders/environment are deferred.

## Flamebringer personality

Run `npm run prototype:personality`. `personalityFixture` names the sword Flamebringer and supplies a second sword with the same versioned template. `core/game/personality.ts` models templates, instance state, relationships, events, memories, conversations, and the dialogue adapter. The personality provider is inherited from the sword definition.

The game emits immutable-snapshot attack events only after committing combat. The separate personality service explicitly consumes them; it is not yet a general event dispatcher. Versioned reaction/inactivity modules update independent relationship state. Icy-target attacks grant 5 affinity, reduce resentment by 2, and create a memory. Any attack resets inactivity; each full 60 idle simulation seconds adds 2 resentment. Scores are clamped to 0–100 and duplicate event IDs are ignored. Inactivity checks are explicit; wall-clock/offline time does not advance the simulation.

Dialogue context includes voice, disposition, listener relationship, preferences, listener-related memories (up to five), eight recent messages, older context, and caller-supplied observations. No automatic whole-world context is included. Perception enforcement is a caller responsibility until visibility rules exist. A deterministic adapter stub replaces a live LLM. Generated replies update conversation history and speech time only, not combat or relationship scores. Conversation failures leave state/history unchanged; one pending response per sword is permitted.

Full transcripts are retained; the older summary is an exact speaker-labeled excerpt, not semantic compression. Thus prompt size is not fully bounded yet. Conversation summaries record their coverage boundary. Personality entity snapshots plus separate memory/conversation records can be restored, including separate listeners. `blurt` rotates original catchphrases with a 30-second cooldown; spontaneous scheduling is demonstrated through explicit opportunities, not a background timer. Public blurt history is not persisted as conversation messages yet.

Personality processing is deliberately separate from the world transaction: production delivery/retry, event ordering, bounded deduplication, perception filtering, model integration, memory consolidation, storage, and mechanical personality bonuses remain open. The fixture’s zero timestamps are illustrative starting history. Gameplay effects remain engine-controlled.
