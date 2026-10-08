import base from './fixtures/world.json' with { type: 'json' };
import extra from './fixtures/inventory.json' with { type: 'json' };
import type { PrototypeFixture } from './engine.ts';
export function inventoryFixture(): PrototypeFixture {
  const data = JSON.parse(JSON.stringify(base)) as PrototypeFixture;
  data.definitions.push(...JSON.parse(JSON.stringify(extra.definitions)));
  data.entities.push(...JSON.parse(JSON.stringify(extra.entities)));
  data.definitions.find(d => d.id === 'definition:robes')!.components.container = extra.robesContainer;
  return data;
}
