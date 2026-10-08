import test from 'node:test';
import assert from 'node:assert/strict';
import { PrototypeWorld } from './engine.ts';
import { inventoryFixture } from './inventory-scenario.ts';
const alice = 'character:alice';
const into = (containerId: string, compartmentId: string) => ({ kind: 'contained' as const, containerId, compartmentId });
const world = () => new PrototypeWorld(inventoryFixture());
test('worn scabbard admits one sword shorter than a meter', () => {
  const w = world(); w.equip(alice, 'item:scabbard');
  w.moveItem(alice, 'item:sword', into('item:scabbard', 'blade'));
  assert.deepEqual(w.directContents('item:scabbard').map(e => e.id), ['item:sword']);
  assert.deepEqual(w.component(alice, 'equipment'), { belt: 'item:scabbard' });
  const before = w.entity('item:long-sword');
  assert.throws(() => w.moveItem(alice, 'item:long-sword', into('item:scabbard', 'blade')), /Too many entities/);
  assert.deepEqual(w.entity('item:long-sword'), before);
});
test('scabbard rejects non-swords, unknown lengths, and exactly one meter', () => {
  const w = world();
  for (const [id, message] of [['item:book', /type/], ['item:unknown-sword', /Length unknown/], ['item:long-sword', /too long/]] as const) {
    const before = w.entity(id);
    assert.throws(() => w.moveItem(alice, id, into('item:scabbard', 'blade')), message);
    assert.deepEqual(w.entity(id), before);
  }
});
test('two independent pockets admit one small OR two extra-small items', () => {
  const w = world(); w.equip(alice, 'item:robes');
  w.moveItem(alice, 'item:book', into('item:robes', 'left-pocket'));
  w.moveItem(alice, 'item:coin-1', into('item:robes', 'right-pocket'));
  w.moveItem(alice, 'item:coin-2', into('item:robes', 'right-pocket'));
  for (const pocket of ['left-pocket', 'right-pocket']) assert.throws(() => w.moveItem(alice, 'item:coin-3', into('item:robes', pocket)), /Size capacity/);
  assert.throws(() => w.moveItem(alice, 'item:sword', into('item:robes', 'left-pocket')), /not admitted/);
  assert.equal(w.directContents('item:robes', 'left-pocket').length, 1);
  assert.equal(w.directContents('item:robes', 'right-pocket').length, 2);
  w.moveItem(alice, 'item:coin-1', { kind: 'carried', actorId: alice });
  assert.throws(() => w.moveItem(alice, 'item:book', into('item:robes', 'right-pocket')), /Size capacity/);
  assert.equal(w.directContents('item:robes', 'left-pocket')[0].id, 'item:book');
});
test('backpack rejects cars, living animals, and heavy items', () => {
  const w = world();
  for (const [id, message] of [['item:car', /type/], ['item:fox', /type/], ['item:anvil', /Burden/]] as const) {
    assert.throws(() => w.moveItem(alice, id, into('item:backpack', 'main')), message);
  }
  w.moveItem(alice, 'item:book', into('item:backpack', 'main'));
  assert.equal(w.directContents('item:backpack').length, 1);
});
test('ten entities means ten instances, even when their definitions match', () => {
  const data = inventoryFixture();
  for (let n = 4; n <= 11; n++) data.entities.push({ id: `item:coin-${n}`, definitionId: 'definition:coin', components: { ownership: { ownerId: alice } } });
  const w = new PrototypeWorld(data);
  for (let n = 1; n <= 10; n++) w.moveItem(alice, `item:coin-${n}`, into('item:backpack', 'main'));
  assert.equal(w.directContents('item:backpack').length, 10);
  assert.throws(() => w.moveItem(alice, 'item:coin-11', into('item:backpack', 'main')), /Too many entities/);
});
test('adding weight inside a pouch rechecks its containing backpack', () => {
  const w = world(); w.moveItem(alice, 'item:pouch', into('item:backpack', 'main'));
  const before = w.entity('item:anvil');
  assert.throws(() => w.moveItem(alice, 'item:anvil', into('item:pouch', 'main')), /Burden/);
  assert.deepEqual(w.entity('item:anvil'), before);
  assert.equal(w.directContents('item:pouch').length, 0);
  w.moveItem(alice, 'item:coin-1', into('item:pouch', 'main'));
  assert.ok(w.carriedInventory(alice).some(e => e.id === 'item:coin-1' && e.placement.kind === 'contained'));
});
test('moving an already loaded pouch also counts its contents', () => {
  const w = world(); w.moveItem(alice, 'item:anvil', into('item:pouch', 'main'));
  assert.throws(() => w.moveItem(alice, 'item:pouch', into('item:backpack', 'main')), /Burden/);
  assert.equal(w.directContents('item:pouch')[0].id, 'item:anvil');
});
test('self-containment, cycles, and unknown compartments preserve placement', () => {
  const w = world();
  assert.throws(() => w.moveItem(alice, 'item:backpack', into('item:backpack', 'main')), /cycle/);
  w.moveItem(alice, 'item:pouch', into('item:backpack', 'main'));
  assert.throws(() => w.moveItem(alice, 'item:backpack', into('item:pouch', 'main')), /cycle/);
  assert.throws(() => w.moveItem(alice, 'item:coin-1', into('item:robes', 'imaginary')), /Unknown compartment/);
  assert.equal(w.directContents('item:backpack')[0].id, 'item:pouch');
});
test('placement is separate from ownership and equipment', () => {
  const w = world(); w.equip(alice, 'item:scabbard');
  w.moveItem(alice, 'item:scabbard', into('item:backpack', 'main'));
  assert.deepEqual(w.component(alice, 'equipment'), {});
  w.equip(alice, 'item:scabbard');
  assert.equal(w.directContents('item:backpack').length, 0);
  w.moveItem(alice, 'item:coin-1', { kind: 'world', placeId: 'room:inn' });
  assert.ok(w.inventory(alice).some(i => i.id === 'item:coin-1'));
  assert.equal(w.carriedInventory(alice).some(i => i.id === 'item:coin-1'), false);
  assert.throws(() => w.moveItem(alice, 'item:coin-2', { kind: 'equipped', actorId: alice, slot: 'finger' }), /Use equip/);
});
