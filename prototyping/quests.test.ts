import test from 'node:test';
import assert from 'node:assert/strict';
import { PrototypeQuests } from './quests.ts';
import { questFixture } from './quest-scenario.ts';
const alice = 'character:alice', giver = 'actor:mage-giver';
function start() { const world = new PrototypeQuests(questFixture()); world.accept('quest:restore-spring', 'quest-instance:main', alice, giver); return world; }
function gather(w: PrototypeQuests) { for (let i = 1; i <= 10; i++) w.collect(alice, `item:sunflower-${i}`); }
function survivor(w: PrototypeQuests) { w.recordEvent({ id: 'event:survivor', type: 'survivor-spoken', actorId: alice, at: w.now, facts: {} }); }
function remedy(w: PrototypeQuests) { w.visit(alice, 'location:valley'); w.advance('quest-instance:main', 'journey'); gather(w); survivor(w); w.advance('quest-instance:main', 'remedy'); }
test('three-stage narrative, parallel objectives, delivery, effects, and one-time rewards', () => {
  const w = start(); assert.ok(w.snapshot().effects.some(e => e.provenance?.id === 'quest-instance:main'));
  assert.throws(() => w.advance('quest-instance:main', 'journey'), /not satisfied/);
  w.visit(alice, 'location:valley'); w.advance('quest-instance:main', 'journey');
  gather(w); assert.throws(() => w.advance('quest-instance:main', 'remedy'), /not satisfied/);
  survivor(w); w.advance('quest-instance:main', 'remedy');
  assert.throws(() => w.advance('quest-instance:main', 'return'), /not satisfied/);
  w.deliver(alice, giver, 'definition:sunflower', 10); const completed = w.advance('quest-instance:main', 'return');
  assert.equal(completed.status, 'completed'); assert.equal(w.snapshot().receipts.length, 3);
  assert.equal(w.snapshot().effects.some(e => e.provenance?.id === completed.id), false);
  const actor = w.snapshot().entities.find(e => e.id === alice)!;
  assert.equal((actor.components.attributes as { strength: number }).strength, 11);
  assert.ok(JSON.stringify(actor.components.progression).includes('spell:flame'));
  assert.equal(w.snapshot().entities.filter(e => e.definitionId === 'definition:quest-fire-sword').length, 1);
  assert.ok(w.snapshot().effects.some(e => e.definitionId === 'effect:reward-fire-sword'));
  assert.equal(w.snapshot().entities.filter(e => e.definitionId === 'definition:sunflower' && (e.components.ownership as { ownerId: string }).ownerId === giver).length, 10);
  w.check(completed.id); assert.throws(() => w.advance(completed.id, 'return'), /not active/); assert.equal(w.snapshot().receipts.length, 3);
});
test('shared objective definitions allow prior evidence or require fresh visits independently', () => {
  const w = start(); w.visit(alice, 'location:valley'); w.advance('quest-instance:main', 'journey');
  w.accept('quest:remember-valley', 'quest-instance:remember', alice, giver); assert.equal(w.check('quest-instance:remember').objectives[0].completed, true);
  w.advance('quest-instance:remember', 'visit');
  w.accept('quest:revisit-valley', 'quest-instance:fresh', alice, giver);
  assert.throws(() => w.advance('quest-instance:fresh', 'visit'), /not satisfied/);
  w.visit(alice, 'location:valley'); w.advance('quest-instance:fresh', 'visit');
});
test('acceptance distinguishes class, level, and equipped inventory; losing item after acceptance does not cancel', () => {
  for (const change of ['class', 'level', 'equipment']) {
    const data = questFixture(); const actor = data.entities.find(e => e.id === alice)!;
    if (change === 'class') data.definitions.find(d => d.id === 'class:sword-wizard')!.components.classTags = [];
    if (change === 'level') (actor.components.progression as unknown as { classes: { level: number }[] }).classes[0].level = 9;
    if (change === 'equipment') { actor.components.equipment = {}; data.entities.find(e => e.id === 'item:ring-42')!.components.placement = { kind: 'carried', actorId: alice }; }
    const w = new PrototypeQuests(data); assert.throws(() => w.accept('quest:restore-spring', 'q', alice, giver), /acceptance/); assert.equal(w.snapshot().quests.length, 0);
  }
  const w = start(); w.drop(alice, 'item:ring-42'); assert.equal(w.check('quest-instance:main').status, 'active');
});
test('current-state objectives recheck carried items even after a recorded satisfaction', () => {
  const w = start(); w.visit(alice, 'location:valley'); w.advance('quest-instance:main', 'journey'); gather(w); survivor(w);
  w.check('quest-instance:main'); w.drop(alice, 'item:sunflower-10');
  assert.throws(() => w.advance('quest-instance:main', 'remedy'), /not satisfied/);
  w.collect(alice, 'item:sunflower-10'); w.advance('quest-instance:main', 'remedy');
});
test('abandonment and failure clean only their quest effects and give no rewards', () => {
  for (const status of ['abandoned', 'failed'] as const) {
    const data = questFixture(); data.effectInstances.push({ id: 'effect:other-protection', definitionId: 'effect:quest-fire-protection', sourceId: giver, targetId: alice, createdAt: 0, state: {} });
    const w = new PrototypeQuests(data); w.accept('quest:restore-spring', 'q', alice, giver); w.terminate('q', status);
    assert.ok(w.snapshot().effects.some(e => e.id === 'effect:other-protection')); assert.equal(w.snapshot().effects.some(e => e.provenance?.id === 'q'), false); assert.equal(w.snapshot().receipts.length, 0);
  }
});
test('invalid reward rolls back completion, attribute changes, receipts, and effect cleanup', () => {
  const data = questFixture(); data.quests[0].rewards.push({ id: 'bad', kind: 'item', definitionId: 'missing', placementPolicy: 'carried' });
  const w = new PrototypeQuests(data); w.accept('quest:restore-spring', 'quest-instance:main', alice, giver); remedy(w); w.deliver(alice, giver, 'definition:sunflower', 10);
  const before = w.snapshot(); assert.throws(() => w.advance('quest-instance:main', 'return'), /Unknown definition/); assert.deepEqual(w.snapshot(), before);
});
test('delivery checks actual carried quantity and duplicate events cannot inflate kill credit', () => {
  const w = start(); assert.throws(() => w.deliver(alice, giver, 'definition:sunflower', 10), /Not enough/); assert.equal(w.snapshot().events.length, 0);
  const data = questFixture(); data.quests.push({ id: 'quest:defeats', version: 1, narrative: 'Defend the road', acceptancePredicates: [], initialStages: ['fight'], stages: [{ id: 'fight', narrative: 'Defeat ten adult orcs', objectives: [{ id: 'kills', objectiveDefinitionId: 'objective:defeat-orcs', objectiveVersion: 1, priorCompletion: 'fresh', completionMode: 'latch' }], requirement: { objective: 'kills' }, next: [] }], rewards: [] });
  const battle = new PrototypeQuests(data); battle.accept('quest:defeats', 'q', alice, giver);
  for (let i = 1; i <= 9; i++) { const event = { id: `kill:${i}`, type: 'defeat-credited', actorId: alice, at: 0, facts: { actorDefinitionId: 'definition:adult-orc' } }; battle.recordEvent(event); battle.recordEvent(event); }
  assert.throws(() => battle.advance('q', 'fight'), /not satisfied/);
  battle.recordEvent({ id: 'kill:10', type: 'defeat-credited', actorId: alice, at: 0, facts: { actorDefinitionId: 'definition:adult-orc' } }); assert.equal(battle.advance('q', 'fight').status, 'completed');
});
test('historical completion is participant- and version-specific', () => {
  const data = questFixture();
  const aliceEntity = structuredClone(data.entities.find(e => e.id === alice)!); aliceEntity.id = 'character:bob'; aliceEntity.components.equipment = {}; data.entities.push(aliceEntity);
  const versionTwo = structuredClone(data.objectiveDefinitions[0]); versionTwo.version = 2; data.objectiveDefinitions.push(versionTwo);
  const questTwo = structuredClone(data.quests[1]); questTwo.id = 'quest:remember-v2'; questTwo.stages[0].objectives[0].objectiveVersion = 2; data.quests.push(questTwo);
  const w = new PrototypeQuests(data); w.accept('quest:restore-spring', 'main', alice, giver); w.visit(alice, 'location:valley'); w.advance('main', 'journey');
  w.accept('quest:remember-valley', 'bob', 'character:bob', giver); assert.equal(w.check('bob').objectives[0].satisfied, false);
  w.accept('quest:remember-v2', 'v2', alice, giver); assert.equal(w.check('v2').objectives[0].satisfied, false);
});
test('forked stages and any/all combinations complete independently; stage effects end on exit', () => {
  const data = questFixture();
  const bind = (id: string) => ({ id, objectiveDefinitionId: 'objective:visit-valley', objectiveVersion: 1, priorCompletion: 'fresh' as const, completionMode: 'latch' as const });
  data.quests.push({ id: 'quest:fork', version: 1, narrative: 'Explore two threads', acceptancePredicates: [], initialStages: ['root'], rewards: [], stages: [
    { id: 'root', narrative: 'Start', objectives: [], requirement: { all: [] }, next: ['left', 'right'], effectsOnEntry: [{ definitionId: 'effect:quest-fire-protection', lifetime: 'stage' }] },
    { id: 'left', narrative: 'Left thread', objectives: [bind('visit-a'), { ...bind('visit-b'), objectiveDefinitionId: 'objective:talk-survivor' }], requirement: { any: [{ objective: 'visit-a' }, { objective: 'visit-b' }] }, next: [] },
    { id: 'right', narrative: 'Right thread', objectives: [bind('visit')], requirement: { objective: 'visit' }, next: [] }
  ] });
  const w = new PrototypeQuests(data); w.accept('quest:fork', 'fork', alice, giver); w.advance('fork', 'root');
  assert.equal(w.snapshot().effects.some(e => e.provenance?.id === 'fork'), false);
  w.visit(alice, 'location:valley'); assert.equal(w.advance('fork', 'left').status, 'active'); assert.equal(w.advance('fork', 'right').status, 'completed');
  data.quests.at(-1)!.stages[0].next = ['root'];
  assert.throws(() => new PrototypeQuests(data).accept('quest:fork', 'bad', alice, giver), /cycle/);
});
