import base from './fixtures/world.json' with { type: 'json' };
import status from './fixtures/status.json' with { type: 'json' };
import { PrototypeWorld } from './engine.ts';
import type { PrototypeFixture } from './engine.ts';
export function statusFixture(): PrototypeFixture {
  return JSON.parse(JSON.stringify({
    definitions: [...base.definitions, ...status.definitions],
    entities: [...base.entities, ...status.entities],
    effectDefinitions: [...base.effectDefinitions, ...status.effectDefinitions],
    effectInstances: [...base.effectInstances, ...status.effectInstances]
  })) as PrototypeFixture;
}
export function runStatusScenario(roll: number) {
  const w = new PrototypeWorld(statusFixture(), { next: () => roll });
  const alice = 'character:alice';
  w.equip(alice, 'item:robes');
  const steps = [{ action: 'Alice before eating', description: w.describe(alice) }];
  w.eat(alice, 'item:stew-1');
  steps.push({ action: 'Alice after eating', description: w.describe(alice) });
  steps.push({ action: 'Robes after eating', description: w.describe('item:robes') });
  if (w.effectsOn('item:robes').length) {
    w.clean(alice, 'item:soap-1', 'item:robes');
    steps.push({ action: 'Robes after soap', description: w.describe('item:robes') });
  }
  return steps;
}
