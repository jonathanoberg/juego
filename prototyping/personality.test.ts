import test from 'node:test';
import assert from 'node:assert/strict';
import { PrototypeWorld } from './engine.ts';
import { PrototypePersonalities } from './personality.ts';
import { personalityFixture, flamebringerTemplate } from './personality-scenario.ts';
import type { DialogueContext } from '../core/game/personality.ts';
const alice = 'character:alice', sword = 'item:sword';
function setup() {
  const data = personalityFixture();
  const world = new PrototypeWorld(data, { next: () => 0 }); world.equip(alice, sword);
  const minds = new PrototypePersonalities(data.entities, [flamebringerTemplate], data.definitions);
  return { data, world, minds };
}
test('committed icy attacks increase affinity independently per sword and only once per event', () => {
  const { world, minds } = setup();
  world.attack({ actorId: alice, weaponId: sword, targetId: 'creature:target' });
  const events = world.events(); minds.process(events); minds.process(events);
  assert.equal(minds.snapshot(sword).relationships[0].affinity, 5);
  assert.equal(minds.snapshot(sword).memoryIds.length, 1);
  assert.equal(minds.snapshot('item:second-flamebringer').relationships.length, 0);
  events[0].facts.targetTags = [];
  assert.deepEqual(world.events()[0].facts.targetTags, ['icy', 'susceptible-to-fire']);
  assert.equal(flamebringerTemplate.initialDisposition.impatience, 70);
});
test('inactivity is simulation-time based, idempotent, and preserves independent affinity', () => {
  const { world, minds } = setup(); world.attack({ actorId: alice, weaponId: sword, targetId: 'creature:target' }); minds.process(world.events());
  minds.evaluateInactivity(sword, alice, 180); minds.evaluateInactivity(sword, alice, 180);
  const relationship = minds.snapshot(sword).relationships[0];
  assert.equal(relationship.resentment, 6); assert.equal(relationship.affinity, 5);
  minds.evaluateInactivity(sword, alice, 181); assert.equal(minds.snapshot(sword).relationships[0].resentment, 6);
  assert.throws(() => minds.evaluateInactivity(sword, alice, 100), /backwards/);
});
test('ordinary targets do not give icy affinity; rejected attacks emit no events', () => {
  const { data } = setup(); data.entities.find(e => e.id === 'creature:target')!.components.traits = { tags: [] };
  const world = new PrototypeWorld(data, { next: () => 0 });
  const minds = new PrototypePersonalities(data.entities, [flamebringerTemplate], data.definitions);
  assert.throws(() => world.attack({ actorId: alice, weaponId: sword, targetId: 'creature:target' }), /equipped/);
  assert.equal(world.events().length, 0);
  world.equip(alice, sword); world.attack({ actorId: alice, weaponId: sword, targetId: 'creature:target' }); minds.process(world.events());
  assert.equal(minds.snapshot(sword).relationships[0].affinity, 0); assert.equal(minds.snapshot(sword).memoryIds.length, 0);
});
test('ongoing dialogue receives relationship, memories, history, and only supplied observations', async () => {
  const { world, minds } = setup(); world.attack({ actorId: alice, weaponId: sword, targetId: 'creature:target' }); minds.process(world.events());
  const contexts: DialogueContext[] = [];
  const adapter = { async respond(context: Readonly<DialogueContext>) { contexts.push(structuredClone(context)); return 'Less talking. More scorching.'; } };
  await minds.talk(sword, alice, 'How was that fight?', 1, [{ entityId: 'creature:target', description: 'An icy creature' }], adapter);
  await minds.talk(sword, alice, 'Do you remember it?', 2, [], adapter);
  assert.equal(contexts[1].relationship.affinity, 5); assert.equal(contexts[1].memories.length, 1);
  assert.equal(contexts[1].recentMessages.length, 3); assert.equal(contexts[1].observations.length, 0);
  assert.equal(minds.history(sword, alice)?.messages.length, 4);
  assert.equal(minds.snapshot(sword).relationships[0].affinity, 5);
  assert.equal((world.component('creature:target', 'health') as { current: number }).current, 99);
});
test('failed dialogue leaves history and personality unchanged', async () => {
  const { minds } = setup(); const before = minds.snapshot(sword);
  await assert.rejects(minds.talk(sword, alice, 'Hello', 0, [], { async respond() { throw new Error('Unavailable'); } }), /Unavailable/);
  assert.equal(minds.history(sword, alice), undefined); assert.deepEqual(minds.snapshot(sword), before);
});
test('catchphrases rotate and respect cooldown including direct conversation', async () => {
  const { minds } = setup();
  assert.equal(minds.blurt(sword, 0), flamebringerTemplate.catchphrases[0]);
  assert.equal(minds.blurt(sword, 29), undefined);
  assert.equal(minds.blurt(sword, 30), flamebringerTemplate.catchphrases[1]);
  await minds.talk(sword, alice, 'Quiet, please', 40, [], { async respond() { return 'Fine.'; } });
  assert.equal(minds.blurt(sword, 50), undefined);
  assert.equal(minds.blurt(sword, 70), flamebringerTemplate.catchphrases[2]);
});
test('conversation records and entity personality state can be restored', async () => {
  const { data, world, minds } = setup(); world.attack({ actorId: alice, weaponId: sword, targetId: 'creature:target' }); minds.process(world.events());
  for (let n = 1; n <= 6; n++) await minds.talk(sword, alice, `Question ${n}`, n, [], { async respond() { return `Answer ${n}`; } });
  const savedEntities = data.entities.map(e => e.id === sword ? minds.entityWithState(e) : e);
  const restored = new PrototypePersonalities(savedEntities, [flamebringerTemplate], data.definitions, minds.records());
  assert.deepEqual(restored.snapshot(sword), minds.snapshot(sword));
  assert.equal(restored.history(sword, alice)?.messages.length, 12);
  await restored.talk(sword, alice, 'Continue', 7, [], { async respond(ctx) {
    assert.equal(ctx.recentMessages.length, 8); assert.ok(ctx.earlierSummary?.includes('Question 1'));
    assert.equal(ctx.memories.length, 1); return 'I remember.';
  } });
  assert.equal(restored.history(sword, alice)?.messages.length, 14);
  await restored.talk(sword, 'character:bob', 'Hello', 8, [], { async respond(ctx) { assert.equal(ctx.relationship.affinity, 0); assert.equal(ctx.recentMessages.length, 1); return 'Who are you?'; } });
  assert.equal(restored.history(sword, alice)?.messages.length, 14);
});
