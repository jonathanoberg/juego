import test from 'node:test';
import assert from 'node:assert/strict';
import { PrototypeWorld } from './engine.ts';
import { runScenario } from './scenario.ts';
const alice = 'character:alice';
test('Alice checks inventory, equips ring, reads scroll, and checks again', () => {
  const steps = runScenario();
  assert.deepEqual(steps.map(s => s.action), ['Check inventory', 'Check stats', 'Put on ring', 'Check stats', 'Read scroll', 'Check stats', 'Check inventory']);
  assert.equal((steps[0].result as unknown[]).length, 5);
  assert.deepEqual(steps[1].result, { strength: 10, intelligence: 12 });
  assert.deepEqual(steps[3].result, { strength: 10, intelligence: 12 });
  const stats = steps[5].result as { strength: number; intelligence: number };
  assert.equal(stats.strength, 11);
  assert.ok(Math.abs(stats.intelligence - 13.2) < 1e-10);
  assert.deepEqual((steps[6].result as { id: string }[]).map(e => e.id), ['item:ring-42', 'item:scroll-18', 'item:robes', 'item:plate']);
});
test('buff does not activate an unworn ring or overwrite base attributes', () => {
  const w = new PrototypeWorld(); w.readScroll(alice, 'item:scroll-17');
  assert.equal(w.stats(alice).strength, 10);
  assert.equal(w.baseAttribute(alice, 'intelligence'), 12);
  assert.equal(w.baseAttribute(alice, 'strength'), 10);
  w.equip(alice, 'item:ring-42'); assert.equal(w.stats(alice).strength, 11);
  w.unequip(alice); assert.equal(w.stats(alice).strength, 10);
});
test('expiration deactivates ring exactly at the lifetime boundary', () => {
  const w = new PrototypeWorld(); w.equip(alice, 'item:ring-42'); w.readScroll(alice, 'item:scroll-17');
  w.advance(299); assert.equal(w.stats(alice).strength, 11);
  w.advance(1); assert.deepEqual(w.stats(alice), { strength: 10, intelligence: 12 });
});
test('consumed scroll cannot be read again; failed use leaves state intact', () => {
  const w = new PrototypeWorld();
  assert.throws(() => w.readScroll(alice, 'item:ring-42'), /usable scroll/);
  assert.equal(w.inventory(alice).length, 5);
  w.readScroll(alice, 'item:scroll-17');
  assert.throws(() => w.readScroll(alice, 'item:scroll-17'), /Unknown entity/);
  assert.equal(w.inventory(alice).length, 4);
});
