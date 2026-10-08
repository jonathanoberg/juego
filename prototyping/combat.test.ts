import test from 'node:test';
import assert from 'node:assert/strict';
import { PrototypeWorld } from './engine.ts';
import { combatFixture } from './combat-scenario.ts';
const alice = 'character:alice', target = 'creature:target', sword = 'item:sword';
const attack = { actorId: alice, weaponId: sword, targetId: target };
function world(samples: number[]) {
  const w = new PrototypeWorld(combatFixture(), { next: () => { const n = samples.shift(); if (n === undefined) throw new Error('Unexpected draw'); return n; } });
  w.equip(alice, sword); return w;
}
function learnFlame(w: PrototypeWorld) {
  w.advanceClassLevel(alice, 'class:sword-wizard'); w.advanceClassLevel(alice, 'class:sword-wizard');
  w.learnSpell(alice, 'class:sword-wizard', 'spell:flame');
}
test('sword rolls inclusive 1–8 slicing damage and changes health', () => {
  for (const [roll, damage] of [[0, 1], [.999, 8]]) {
    const w = world([0, roll]); const result = w.attack(attack);
    assert.equal(result.damage, damage); assert.equal(result.damageType, 'slicing');
    assert.equal((w.component(target, 'health') as { current: number }).current, 100 - damage);
  }
});
test('shield reduces hit probability; a miss is an outcome with no damage draw', () => {
  const normal = world([.6, 0]); assert.equal(normal.attack(attack).hit, true);
  const shielded = world([.6]); shielded.equip(target, 'item:shield');
  const result = shielded.attack(attack);
  assert.equal(result.hit, false); assert.ok(Math.abs(result.hitChance - .45) < 1e-10);
  assert.equal((shielded.component(target, 'health') as { current: number }).current, 100);
});
test('robes and plate reduce damage independently from hit probability', () => {
  for (const [id, damage] of [['item:target-robes', 7], ['item:target-plate', 2]] as const) {
    const w = world([0, .999]); w.equip(target, id); const result = w.attack(attack);
    assert.equal(result.hitChance, .75); assert.equal(result.damage, damage);
  }
  const w = world([0, 0]); w.equip(target, 'item:target-plate'); assert.equal(w.attack(attack).damage, 0);
});
test('flame doubles damage for susceptibility, then armor subtracts; base weapon stays unchanged', () => {
  const w = world([0, .999]); learnFlame(w); w.activateSwordFlame(alice, sword);
  w.equip(target, 'item:target-plate');
  assert.equal(w.describe(sword), 'Short Sword, wreathed in flame');
  const result = w.attack(attack);
  assert.equal(result.damageMultiplier, 2); assert.equal(result.damage, 10); assert.equal(result.damageType, 'slicing');
  assert.deepEqual((w.component(sword, 'weapon') as { damage: unknown }).damage, { minimum: 1, maximum: 8, type: 'slicing' });
});
test('flame does not multiply damage for a non-susceptible target', () => {
  const data = combatFixture(); data.entities.find(e => e.id === target)!.components.traits = { tags: [] };
  const w = new PrototypeWorld(data, { next: () => 0 }); w.equip(alice, sword); learnFlame(w); w.activateSwordFlame(alice, sword);
  assert.equal(w.attack(attack).damageMultiplier, 1);
});
test('flame expires exactly at sixty seconds and its description disappears', () => {
  const w = world([0, 0, 0, 0]); learnFlame(w); w.activateSwordFlame(alice, sword);
  assert.throws(() => w.activateSwordFlame(alice, sword), /already active/);
  w.advance(59); assert.equal(w.attack(attack).damage, 2);
  w.advance(1); assert.equal(w.attack(attack).damage, 1); assert.equal(w.describe(sword), 'Short Sword');
});
test('invalid actions and invalid randomness leave health unchanged', () => {
  const w = world([1]); assert.throws(() => w.activateSwordFlame(alice, sword), /not been learned/);
  assert.throws(() => w.attack(attack), /Invalid random/);
  assert.equal((w.component(target, 'health') as { current: number }).current, 100);
  w.unequip(alice, 'hand'); assert.throws(() => w.attack(attack), /equipped in hand/);
});
test('a stronger dodge skill lowers hit chance and shields combine with body armor', () => {
  const data = combatFixture(); data.entities.find(e => e.id === target)!.components.skills = { dodge: 10 };
  const w = new PrototypeWorld(data, { next: () => 0 }); w.equip(alice, sword);
  w.equip(target, 'item:shield'); w.equip(target, 'item:target-plate');
  const result = w.attack(attack);
  assert.ok(Math.abs(result.hitChance - .35) < 1e-10); assert.equal(result.damage, 0);
});
