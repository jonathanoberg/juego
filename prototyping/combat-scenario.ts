import extra from './fixtures/combat.json' with { type: 'json' };
import { inventoryFixture } from './inventory-scenario.ts';
export function combatFixture() {
  const data = inventoryFixture();
  data.definitions.push(...JSON.parse(JSON.stringify(extra.definitions)));
  data.entities.push(...JSON.parse(JSON.stringify(extra.entities)));
  data.effectDefinitions.push(...JSON.parse(JSON.stringify(extra.effectDefinitions)));
  const sword = data.definitions.find(d => d.id === 'definition:sword')!;
  sword.components.equippable = { slots: ['hand'] };
  sword.components.weapon = { attackBehavior: { id: 'sword-attack', version: 1, parameters: {} }, skillId: 'sword', damage: { minimum: 1, maximum: 8, type: 'slicing' } };
  const alice = data.entities.find(e => e.id === 'character:alice')!;
  alice.components.skills = { sword: 5 };
  alice.components.health = { current: 50 };
  return data;
}
