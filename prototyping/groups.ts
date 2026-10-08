import type { Definition, Entity, RandomSource } from '../core/game/index.ts';
import type { GroupMembership, SpawnRecipe, CreatureComponent, RoleDefinitionComponent } from '../core/game/groups.ts';
import type { PersonalityDefinition } from '../core/game/personality.ts';
import { PrototypePersonalities } from './personality.ts';
function draw(random: RandomSource) {
  const value = random.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid spawn random sample');
  return value;
}
function nonnegativeInteger(n: number) { if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid spawn count'); }
export function spawnGroup(recipe: SpawnRecipe, groupId: string, name: string, definitions: Definition[], personalities: PersonalityDefinition[], random: RandomSource) {
  const definition = (id: string) => { const d = definitions.find(d => d.id === id); if (!d) throw new Error(`Unknown definition: ${id}`); return d; };
  if (!groupId.trim()) throw new Error('Missing group identity');
  const groupDefinition = definition(recipe.groupDefinitionId);
  if (!groupDefinition.components.group) throw new Error('Recipe must reference a group');
  for (const member of recipe.members) {
    if (!definition(member.definitionId).components.actor) throw new Error('Member definition must be an actor');
    nonnegativeInteger(member.count.minimum); nonnegativeInteger(member.count.maximum);
    if (member.count.maximum < member.count.minimum) throw new Error('Invalid spawn count range');
  }
  for (const assignment of recipe.roleAssignments) {
    if (!definition(assignment.roleDefinitionId).components.role) throw new Error('Unknown role definition');
    nonnegativeInteger(assignment.maximumCount);
    if (!Number.isFinite(assignment.probabilityPerCandidate) || assignment.probabilityPerCandidate < 0 || assignment.probabilityPerCandidate > 1) throw new Error('Invalid role probability');
  }
  const entities: Entity[] = [{ id: groupId, definitionId: groupDefinition.id, components: { identity: { name }, group: structuredClone(groupDefinition.components.group) } }];
  const memberships: GroupMembership[] = [];
  let serial = 1;
  for (const entry of recipe.members) {
    const count = entry.count.minimum === entry.count.maximum ? entry.count.minimum : entry.count.minimum + Math.floor(draw(random) * (entry.count.maximum - entry.count.minimum + 1));
    for (let n = 0; n < count; n++) {
      const actor: Entity = { id: `${groupId}:actor:${serial++}`, definitionId: entry.definitionId, components: { identity: { name: `${definition(entry.definitionId).name} ${serial - 1}` }, actorRoles: { definitionIds: [] }, capabilities: { ids: [] } } };
      entities.push(actor); memberships.push({ groupId, memberId: actor.id, roles: [] });
    }
  }
  for (const assignment of recipe.roleAssignments) {
    const role = definition(assignment.roleDefinitionId).components.role as unknown as RoleDefinitionComponent;
    const candidates = entities.slice(1).filter(e => {
      const creature = (e.components.creature ?? definition(e.definitionId).components.creature) as unknown as CreatureComponent | undefined;
      const ids = (e.components.actorRoles as { definitionIds: string[] }).definitionIds;
      return creature && !ids.includes(assignment.roleDefinitionId) &&
        (assignment.eligible.speciesId === undefined || creature.speciesId === assignment.eligible.speciesId) &&
        (assignment.eligible.lifeStage === undefined || creature.lifeStage === assignment.eligible.lifeStage);
    });
    if (assignment.maximumCount === 0 || assignment.probabilityPerCandidate === 0) continue;
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(draw(random) * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    let assigned = entities.slice(1).filter(e => (e.components.actorRoles as { definitionIds: string[] }).definitionIds.includes(assignment.roleDefinitionId)).length;
    for (const actor of candidates) {
      if (assigned >= assignment.maximumCount) break;
      if (assignment.probabilityPerCandidate < 1 && draw(random) >= assignment.probabilityPerCandidate) continue;
      (actor.components.actorRoles as { definitionIds: string[] }).definitionIds.push(assignment.roleDefinitionId);
      const capabilities = actor.components.capabilities as { ids: string[] };
      capabilities.ids = [...new Set([...capabilities.ids, ...role.capabilityIds])];
      memberships.find(m => m.memberId === actor.id)!.roles.push(role.membershipRole);
      assigned++;
    }
  }
  // Materialize independent starting minds, including the group's collective identity.
  const minds = new PrototypePersonalities(entities, personalities, definitions);
  for (let n = 0; n < entities.length; n++) {
    const e = entities[n];
    if (e.components.personalityProvider || definition(e.definitionId).components.personalityProvider) entities[n] = minds.entityWithState(e);
  }
  return { recipeId: recipe.id, entities, memberships };
}
export class PrototypeGroups {
  private entities: Entity[];
  private memberships: GroupMembership[];
  private definitions: Definition[];
  constructor(entities: Entity[], definitions: Definition[], memberships: GroupMembership[] = []) {
    if (new Set(entities.map(e => e.id)).size !== entities.length) throw new Error('Duplicate entity identity');
    this.entities = structuredClone(entities); this.definitions = structuredClone(definitions); this.memberships = [];
    for (const membership of memberships) this.join(membership);
  }
  private hasComponent(id: string, key: string) {
    const e = this.entities.find(e => e.id === id); return e && (e.components[key] ?? this.definitions.find(d => d.id === e.definitionId)?.components[key]);
  }
  join(membership: GroupMembership) {
    if (!this.hasComponent(membership.groupId, 'group')) throw new Error('Unknown group');
    if (!this.hasComponent(membership.memberId, 'actor')) throw new Error('Unknown actor');
    if (this.memberships.some(m => m.groupId === membership.groupId && m.memberId === membership.memberId)) throw new Error('Membership already exists');
    this.memberships.push(structuredClone(membership));
  }
  leave(groupId: string, memberId: string) { this.memberships = this.memberships.filter(m => m.groupId !== groupId || m.memberId !== memberId); }
  members(groupId: string) { return structuredClone(this.memberships.filter(m => m.groupId === groupId)); }
  groupsOf(memberId: string) { return structuredClone(this.memberships.filter(m => m.memberId === memberId)); }
  entity(id: string) { return structuredClone(this.entities.find(e => e.id === id)); }
}
