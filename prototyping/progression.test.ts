import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/world.json' with { type: 'json' };
import type { PrototypeFixture } from './engine.ts';
import { PrototypeWorld } from './engine.ts';
const alice = 'character:alice';
const wizard = 'class:sword-wizard';
test('Alice has standardized class progression and separate spell mastery', () => {
  const w = new PrototypeWorld();
  const p = w.progression(alice).classes[0];
  assert.equal(p.classDefinitionId, wizard);
  assert.equal(p.level, 3);
  assert.deepEqual(p.achievedLevels.map(l => l.level), [1, 2, 3]);
  assert.equal(p.spellSelections[1].masteryRank, 2);
  p.level = 99;
  assert.equal(w.progression(alice).classes[0].level, 3);
});
test('robes are allowed, plate is rejected without disturbing equipment', () => {
  const w = new PrototypeWorld();
  w.equip(alice, 'item:ring-42');
  w.equip(alice, 'item:robes');
  assert.deepEqual(w.component(alice, 'equipment'), { finger: 'item:ring-42', body: 'item:robes' });
  assert.throws(() => w.equip(alice, 'item:plate'), /does not allow armor category: plate/);
  assert.deepEqual(w.component(alice, 'equipment'), { finger: 'item:ring-42', body: 'item:robes' });
  w.unequip(alice);
  assert.deepEqual(w.component(alice, 'equipment'), { body: 'item:robes' });
});
test('class spell offerings enforce level, chosen spells, and class membership', () => {
  const w = new PrototypeWorld();
  const available = w.availableSpells(alice, wizard);
  assert.equal(available.find(s => s.spellDefinitionId === 'spell:light')?.learned, true);
  assert.equal(available.find(s => s.spellDefinitionId === 'spell:ward')?.learnable, true);
  assert.equal(available.find(s => s.spellDefinitionId === 'spell:flame')?.learnable, false);
  const before = w.progression(alice);
  assert.throws(() => w.learnSpell(alice, wizard, 'spell:flame'), /Requires class level 5/);
  assert.throws(() => w.learnSpell(alice, wizard, 'spell:unknown'), /not offered/);
  assert.throws(() => w.learnSpell(alice, 'class:other', 'spell:ward'), /does not belong/);
  assert.deepEqual(w.progression(alice), before);
  w.advance(10); w.learnSpell(alice, wizard, 'spell:ward');
  assert.deepEqual(w.progression(alice).classes[0].spellSelections.at(-1), { spellDefinitionId: 'spell:ward', learnedAtClassLevel: 3, learnedAt: 10, masteryRank: 1 });
  assert.throws(() => w.learnSpell(alice, wizard, 'spell:ward'), /Already learned/);
});
test('achieved levels are recorded and unlock spells without automatically selecting them', () => {
  const w = new PrototypeWorld();
  w.advanceClassLevel(alice, wizard); w.advance(20); w.advanceClassLevel(alice, wizard);
  const p = w.progression(alice).classes[0];
  assert.equal(p.level, 5);
  assert.deepEqual(p.achievedLevels.at(-1), { level: 5, achievedAt: 20 });
  assert.equal(w.availableSpells(alice, wizard).find(s => s.spellDefinitionId === 'spell:flame')?.learnable, true);
  assert.equal(p.spellSelections.some(s => s.spellDefinitionId === 'spell:flame'), false);
  w.learnSpell(alice, wizard, 'spell:flame');
  for (let n = 5; n < 20; n++) w.advanceClassLevel(alice, wizard);
  assert.throws(() => w.advanceClassLevel(alice, wizard), /Maximum class level/);
});

test('spell prerequisites remain required even when the level requirement passes', () => {
  const data = JSON.parse(JSON.stringify(fixture)) as PrototypeFixture;
  const progression = data.entities[0].components.progression as unknown as { classes: { spellSelections: { spellDefinitionId: string }[] }[] };
  progression.classes[0].spellSelections = progression.classes[0].spellSelections.filter(s => s.spellDefinitionId !== 'spell:light');
  const w = new PrototypeWorld(data);
  const before = w.progression(alice);
  assert.throws(() => w.learnSpell(alice, wizard, 'spell:ward'), /Requires spell spell:light/);
  assert.deepEqual(w.progression(alice), before);
  w.learnSpell(alice, wizard, 'spell:light');
  w.learnSpell(alice, wizard, 'spell:ward');
});
