import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnGroup, PrototypeGroups } from './groups.ts';
import { groupFixture } from './groups-scenario.ts';
import { PrototypePersonalities } from './personality.ts';
function spawn(roll: number, probability = .2, maximum = 1) {
  const data = groupFixture(); data.recipe.roleAssignments[0].probabilityPerCandidate = probability; data.recipe.roleAssignments[0].maximumCount = maximum;
  return { ...data, result: spawnGroup(data.recipe, 'group:ash-tooth', 'Ash Tooth Tribe', data.definitions, data.personalities, { next: () => roll }) };
}
test('inclusive counts create stable individual identities and a named group', () => {
  for (const [roll, adults, children] of [[0, 2, 3], [.999, 7, 10]]) {
    const { result } = spawn(roll);
    assert.equal(result.entities.filter(e => e.definitionId === 'definition:adult-orc').length, adults);
    assert.equal(result.entities.filter(e => e.definitionId === 'definition:orc-child').length, children);
    assert.equal(result.memberships.length, adults + children);
    assert.equal(new Set(result.entities.map(e => e.id)).size, adults + children + 1);
    assert.deepEqual(result.entities[0].components.identity, { name: 'Ash Tooth Tribe' });
    assert.equal(result.entities[0].components.group !== undefined, true);
    assert.equal(result.entities[0].components.container, undefined);
  }
});
test('probability one guarantees exactly one existing adult, without adding another actor', () => {
  const { result } = spawn(0, 1);
  const shamans = result.memberships.filter(m => m.roles.includes('shaman'));
  assert.equal(shamans.length, 1); assert.equal(result.entities.length, 6);
  const actor = result.entities.find(e => e.id === shamans[0].memberId)!;
  assert.equal(actor.definitionId, 'definition:adult-orc');
  assert.deepEqual(actor.components.actorRoles, { definitionIds: ['role:orc-shaman'] });
  assert.deepEqual(actor.components.capabilities, { ids: ['spellcasting:orc-shaman'] });
});
test('probability and maximum are independent; children never become shamans', () => {
  assert.equal(spawn(.999, .2).result.memberships.filter(m => m.roles.includes('shaman')).length, 0);
  assert.equal(spawn(0, 0).result.memberships.filter(m => m.roles.includes('shaman')).length, 0);
  assert.equal(spawn(0, 1, 0).result.memberships.filter(m => m.roles.includes('shaman')).length, 0);
  const { result } = spawn(0, 1, 2);
  assert.equal(result.memberships.filter(m => m.roles.includes('shaman')).length, 2);
  for (const m of result.memberships.filter(m => m.roles.includes('shaman'))) assert.equal(result.entities.find(e => e.id === m.memberId)?.definitionId, 'definition:adult-orc');
});
test('no eligible adults means no guaranteed shaman; malformed content is rejected', () => {
  const data = groupFixture(); data.recipe.members[0].count = { minimum: 0, maximum: 0 }; data.recipe.roleAssignments[0].probabilityPerCandidate = 1;
  const result = spawnGroup(data.recipe, 'group:empty-adults', 'Tribe', data.definitions, data.personalities, { next: () => 0 });
  assert.equal(result.memberships.some(m => m.roles.includes('shaman')), false);
  data.recipe.roleAssignments[0].probabilityPerCandidate = 2;
  assert.throws(() => spawnGroup(data.recipe, 'group:bad', 'Bad', data.definitions, data.personalities, { next: () => { throw new Error('Should not draw'); } }), /Invalid role probability/);
  data.recipe.roleAssignments[0].probabilityPerCandidate = 1;
  assert.throws(() => spawnGroup(data.recipe, 'group:bad', 'Bad', data.definitions, data.personalities, { next: () => 1 }), /Invalid spawn random/);
});
test('candidate shuffle prevents deterministic preference for the first adult', () => {
  const low = spawn(0, 1).result, high = spawn(.999, 1).result;
  assert.notEqual(low.memberships.find(m => m.roles.includes('shaman'))?.memberId, low.entities[1].id);
  assert.equal(high.memberships.find(m => m.roles.includes('shaman'))?.memberId, high.entities[1].id);
});
test('multiple memberships and leaving do not erase personal training or alter spawn recipes', () => {
  const { result, definitions, recipe } = spawn(0, 1);
  const party = { id: 'group:hunt', definitionId: 'definition:hunting-party', components: {} };
  const groups = new PrototypeGroups([...result.entities, party], definitions, result.memberships);
  const shaman = result.memberships.find(m => m.roles.includes('shaman'))!.memberId;
  groups.join({ groupId: party.id, memberId: shaman, roles: ['guide'] });
  assert.equal(groups.groupsOf(shaman).length, 2);
  assert.throws(() => groups.join({ groupId: party.id, memberId: shaman, roles: [] }), /already exists/);
  groups.leave('group:ash-tooth', shaman);
  assert.equal(groups.groupsOf(shaman).length, 1);
  assert.deepEqual(groups.entity(shaman)?.components.capabilities, { ids: ['spellcasting:orc-shaman'] });
  assert.equal(recipe.members[0].count.minimum, 2);
  assert.equal(groups.members('group:ash-tooth').length, 4);
  assert.throws(() => groups.join({ groupId: 'group:missing', memberId: shaman, roles: [] }), /Unknown group/);
});
test('group and individual minds retain separate relationships and conversation knowledge', async () => {
  const { result, definitions, personalities } = spawn(0);
  const minds = new PrototypePersonalities(result.entities, personalities, definitions);
  const actor = result.entities[1].id, group = result.entities[0].id;
  await minds.talk(actor, 'character:alice', 'Hello', 0, [], { async respond() { return 'Greetings.'; } });
  assert.equal(minds.snapshot(actor).relationships.length, 1);
  assert.equal(minds.snapshot(group).relationships.length, 0);
  assert.equal(minds.snapshot(result.entities[2].id).relationships.length, 0);
  assert.equal(minds.history(group, 'character:alice'), undefined);
  assert.notEqual(minds.snapshot(group).definitionId, minds.snapshot(actor).definitionId);
});
