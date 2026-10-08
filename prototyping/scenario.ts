import { PrototypeWorld } from './engine.ts';
export function runScenario(world = new PrototypeWorld()) {
  const actor = 'character:alice';
  const steps: { action: string; result: unknown }[] = [];
  steps.push({ action: 'Check inventory', result: world.inventory(actor) });
  steps.push({ action: 'Check stats', result: world.stats(actor) });
  world.equip(actor, 'item:ring-42');
  steps.push({ action: 'Put on ring', result: 'Ring equipped' });
  steps.push({ action: 'Check stats', result: world.stats(actor) });
  world.readScroll(actor, 'item:scroll-17');
  steps.push({ action: 'Read scroll', result: 'Scroll consumed; intelligence effect attached' });
  steps.push({ action: 'Check stats', result: world.stats(actor) });
  steps.push({ action: 'Check inventory', result: world.inventory(actor) });
  return steps;
}
