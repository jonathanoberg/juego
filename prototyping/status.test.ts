import test from 'node:test';
import assert from 'node:assert/strict';
import { PrototypeWorld } from './engine.ts';
import { statusFixture } from './status-scenario.ts';
const alice = 'character:alice';
function world(roll: number) { const w = new PrototypeWorld(statusFixture(), { next: () => roll }); w.equip(alice, 'item:robes'); return w; }
test('spill satisfies hunger, consumes stew, stains the actual robes, then soap removes stain', () => {
  const w = world(0.1);
  assert.equal(w.describe(alice), 'Adventurer, hungry');
  const original = w.entity('item:robes');
  w.eat(alice, 'item:stew-1');
  assert.equal(w.describe(alice), 'Adventurer');
  assert.equal(w.entity('item:stew-1'), undefined);
  assert.equal(w.describe('item:robes'), 'Wizard Robes, covered in stew stains');
  assert.deepEqual(w.entity('item:robes'), original);
  const stain = w.effectsOn('item:robes')[0];
  assert.equal(stain.sourceId, 'item:stew-1');
  w.advance(100000); assert.equal(w.effectsOn('item:robes').length, 1);
  w.clean(alice, 'item:soap-1', 'item:robes');
  assert.equal(w.describe('item:robes'), 'Wizard Robes');
  assert.equal(w.effectsOn('item:robes').length, 0);
  assert.equal(w.entity('item:soap-1'), undefined);
  assert.deepEqual(w.component(alice, 'equipment'), { body: 'item:robes' });
  assert.throws(() => w.eat(alice, 'item:stew-1'), /not owned/);
});
test('no spill at or above threshold; food still satisfies hunger', () => {
  for (const roll of [0.25, 0.9]) {
    const w = world(roll); w.eat(alice, 'item:stew-1');
    assert.equal(w.describe('item:robes'), 'Wizard Robes');
    assert.equal(w.effectsOn(alice).length, 0);
    assert.ok(w.entity('item:soap-1'));
    assert.throws(() => w.clean(alice, 'item:soap-1', 'item:robes'), /No removable stains/);
    assert.ok(w.entity('item:soap-1'));
  }
});
test('invalid random sample causes no world changes', () => {
  const w = world(1); const before = w.inventory(alice);
  assert.throws(() => w.eat(alice, 'item:stew-1'), /Invalid random sample/);
  assert.deepEqual(w.inventory(alice), before);
  assert.equal(w.effectsOn(alice).length, 1);
  assert.equal(w.effectsOn('item:robes').length, 0);
});
test('unworn robes are not stained and eating does not need a random draw', () => {
  const w = new PrototypeWorld(statusFixture(), { next: () => { throw new Error('Unexpected draw'); } });
  w.eat(alice, 'item:stew-1');
  assert.equal(w.describe('item:robes'), 'Wizard Robes');
  assert.equal(w.effectsOn(alice).length, 0);
});
test('soap removes washable stains by tags and preserves unrelated effects', () => {
  const data = statusFixture();
  data.effectDefinitions.push({ id: 'effect:enchanted-cloth', tags: ['magic'], predicates: [], contributions: [] });
  data.effectDefinitions.push({ id: 'effect:permanent-stain', tags: ['stain'], predicates: [], contributions: [] });
  for (const id of ['effect:enchanted-cloth', 'effect:permanent-stain']) data.effectInstances.push({ id, definitionId: id, sourceId: 'item:robes', targetId: 'item:robes', createdAt: 0, state: {} });
  const w = new PrototypeWorld(data, { next: () => 0 }); w.equip(alice, 'item:robes'); w.eat(alice, 'item:stew-1');
  const snapshot = w.effectsOn('item:robes'); snapshot[0].state.changed = true;
  assert.equal(w.effectsOn('item:robes')[0].state.changed, undefined);
  w.clean(alice, 'item:soap-1', 'item:robes');
  assert.deepEqual(w.effectsOn('item:robes').map(e => e.definitionId), ['effect:enchanted-cloth', 'effect:permanent-stain']);
});
test('ownership checks reject eating or cleaning someone else’s belongings', () => {
  const data = statusFixture();
  data.entities.find(e => e.id === 'item:stew-1')!.components.ownership = { ownerId: 'other' };
  data.entities.find(e => e.id === 'item:robes')!.components.ownership = { ownerId: 'other' };
  const w = new PrototypeWorld(data, { next: () => 0 });
  assert.throws(() => w.eat(alice, 'item:stew-1'), /not owned/);
  assert.throws(() => w.clean(alice, 'item:soap-1', 'item:robes'), /must be owned/);
  assert.ok(w.entity('item:stew-1')); assert.ok(w.entity('item:soap-1'));
  assert.equal(w.effectsOn(alice).length, 1);
});
