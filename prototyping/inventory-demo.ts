import { PrototypeWorld } from './engine.ts';
import { inventoryFixture } from './inventory-scenario.ts';
const w = new PrototypeWorld(inventoryFixture());
const alice = 'character:alice';
w.equip(alice, 'item:robes'); w.equip(alice, 'item:scabbard');
w.moveItem(alice, 'item:sword', { kind: 'contained', containerId: 'item:scabbard', compartmentId: 'blade' });
w.moveItem(alice, 'item:book', { kind: 'contained', containerId: 'item:robes', compartmentId: 'left-pocket' });
for (const id of ['item:coin-1', 'item:coin-2']) w.moveItem(alice, id, { kind: 'contained', containerId: 'item:robes', compartmentId: 'right-pocket' });
for (const [id, compartment] of [['item:scabbard', 'blade'], ['item:robes', 'left-pocket'], ['item:robes', 'right-pocket']]) {
  console.log(`${id}/${compartment}: ${w.directContents(id, compartment).map(e => e.id).join(', ')}`);
}
try { w.moveItem(alice, 'item:coin-3', { kind: 'contained', containerId: 'item:robes', compartmentId: 'right-pocket' }); }
catch (error) { console.log(`Third coin rejected: ${(error as Error).message}`); }
try { w.moveItem(alice, 'item:fox', { kind: 'contained', containerId: 'item:backpack', compartmentId: 'main' }); }
catch (error) { console.log(`Fox rejected: ${(error as Error).message}`); }
