import { randomUUID } from 'node:crypto';
import type { Definition, Entity, EffectDefinition, EffectInstance, JsonValue } from '../core/game/index.ts';
import type { ObjectiveDefinition, ObjectiveInstance, QuestDefinition, QuestInstance, QuestStage, ObjectiveRequirement, ObjectiveCompletionRecord, RewardReceipt } from '../core/game/quests.ts';
import type { ProgressionComponent, ClassDefinitionComponent } from '../core/game/progression.ts';
import { PrototypeInventory } from './inventory.ts';
import { evaluateObjective, goalSignature } from './quest-objectives.ts';
import type { QuestEvent } from './quest-objectives.ts';
export interface QuestFixture {
  definitions: Definition[]; entities: Entity[]; effectDefinitions: EffectDefinition[]; effectInstances: EffectInstance[];
  quests: QuestDefinition[]; objectiveDefinitions: ObjectiveDefinition[];
}
interface State { entities: Entity[]; effects: EffectInstance[]; quests: QuestInstance[]; completions: ObjectiveCompletionRecord[]; receipts: RewardReceipt[]; events: QuestEvent[]; }
export class PrototypeQuests {
  private fixture: QuestFixture;
  private state: State;
  now = 0;
  constructor(fixture: QuestFixture) {
    this.fixture = structuredClone(fixture);
    this.state = { entities: new PrototypeInventory(fixture.entities, fixture.definitions).snapshot(), effects: structuredClone(fixture.effectInstances), quests: [], completions: [], receipts: [], events: [] };
  }
  snapshot() { return structuredClone(this.state); }
  private entity(state: State, id: string) { const e = state.entities.find(e => e.id === id); if (!e) throw new Error(`Unknown entity: ${id}`); return e; }
  private definition(id: string) { const d = this.fixture.definitions.find(d => d.id === id); if (!d) throw new Error(`Unknown definition: ${id}`); return d; }
  private questDefinition(id: string, version?: number) { const d = this.fixture.quests.find(q => q.id === id && (version === undefined || q.version === version)); if (!d) throw new Error('Unknown quest version'); return d; }
  private objectiveDefinition(id: string, version: number) { const d = this.fixture.objectiveDefinitions.find(o => o.id === id && o.version === version); if (!d) throw new Error('Unknown objective version'); return d; }
  private instance(state: State, id: string) { const q = state.quests.find(q => q.id === id); if (!q) throw new Error('Unknown quest instance'); return q; }
  private activate(state: State, q: QuestInstance, stage: QuestStage) {
    if (q.activeStages.includes(stage.id) || q.completedStages.includes(stage.id)) return;
    q.activeStages.push(stage.id);
    for (const binding of stage.objectives) {
      const d = this.objectiveDefinition(binding.objectiveDefinitionId, binding.objectiveVersion);
      const prior = binding.priorCompletion === 'allow' ? state.completions.find(c => c.participantId === q.participantId && c.objectiveDefinitionId === d.id && c.objectiveVersion === d.version && c.goalSignature === goalSignature(d)) : undefined;
      q.objectives.push({ id: `${q.id}/${stage.id}/${binding.id}`, bindingId: binding.id, stageId: stage.id, definitionId: d.id, version: d.version,
        activatedAt: this.now, eventOffset: state.events.length, satisfied: !!prior, completed: !!prior, evidenceIds: prior ? [prior.id] : [] });
    }
    for (const grant of stage.effectsOnEntry ?? []) {
      if (!this.fixture.effectDefinitions.some(e => e.id === grant.definitionId)) throw new Error('Unknown quest effect');
      state.effects.push({ id: `${q.id}/${stage.id}/effect/${grant.definitionId}`, definitionId: grant.definitionId, sourceId: q.giverId, targetId: q.participantId, createdAt: this.now,
        state: {}, provenance: { kind: 'quest', id: q.id, stageId: stage.id, lifetime: grant.lifetime } });
    }
  }
  accept(definitionId: string, instanceId: string, participantId: string, giverId: string) {
    const state = structuredClone(this.state); const participant = this.entity(state, participantId); this.entity(state, giverId);
    if (state.quests.some(q => q.id === instanceId)) throw new Error('Quest identity already exists');
    const d = this.questDefinition(definitionId);
    const progress = participant.components.progression as unknown as ProgressionComponent | undefined;
    for (const ref of d.acceptancePredicates) {
      if (ref.version !== 1) throw new Error('Unknown acceptance predicate version');
      const p = ref.parameters;
      let accepted = false;
      if (ref.id === 'class-tag') accepted = !!progress?.classes.some(c => (this.definition(c.classDefinitionId).components.classTags as string[] | undefined)?.includes(p.tag as string));
      else if (ref.id === 'class-level') accepted = !!progress?.classes.some(c => c.classDefinitionId === p.classDefinitionId && c.level >= (p.minimum as number));
      else if (ref.id === 'has-item') {
        const owned = state.entities.filter(e => (e.components.ownership as { ownerId?: string } | undefined)?.ownerId === participantId);
        const scope = p.scope;
        if (!['owned', 'carried', 'equipped'].includes(scope as string)) throw new Error('Unknown inventory scope');
        const carried = new Set(new PrototypeInventory(state.entities, this.fixture.definitions).carried(participantId).map(e => e.id));
        const equipment = new Set(Object.values((participant.components.equipment ?? {}) as Record<string, JsonValue>));
        accepted = owned.some(e => e.definitionId === p.itemDefinitionId && (scope === 'owned' || scope === 'carried' && carried.has(e.id) || scope === 'equipped' && equipment.has(e.id)));
      } else throw new Error('Unknown acceptance predicate');
      if (!accepted) throw new Error(`Quest acceptance requirement failed: ${ref.id}`);
    }
    if (new Set(d.stages.map(s => s.id)).size !== d.stages.length) throw new Error('Duplicate quest stage');
    for (const stage of d.stages) for (const next of stage.next) if (!d.stages.some(s => s.id === next)) throw new Error('Unknown next stage');
    if (!d.initialStages.length || new Set(d.rewards.map(r => r.id)).size !== d.rewards.length) throw new Error('Invalid quest roots or reward identities');
    const visiting = new Set<string>(), visited = new Set<string>();
    const validateGraph = (id: string) => {
      if (visiting.has(id)) throw new Error('Quest stage cycle is unsupported');
      if (visited.has(id)) return;
      const stage = d.stages.find(s => s.id === id); if (!stage) throw new Error('Unknown stage');
      if (new Set(stage.objectives.map(o => o.id)).size !== stage.objectives.length) throw new Error('Duplicate objective binding');
      for (const binding of stage.objectives) this.objectiveDefinition(binding.objectiveDefinitionId, binding.objectiveVersion);
      visiting.add(id); for (const next of stage.next) validateGraph(next); visiting.delete(id); visited.add(id);
    };
    for (const stage of d.stages) validateGraph(stage.id);
    const q: QuestInstance = { id: instanceId, definitionId: d.id, definitionVersion: d.version, participantId, giverId, status: 'active', activeStages: [], completedStages: [], objectives: [], rewardReceiptIds: [] };
    state.quests.push(q);
    for (const id of d.initialStages) { const stage = d.stages.find(s => s.id === id); if (!stage) throw new Error('Unknown initial stage'); this.activate(state, q, stage); }
    this.state = state; return structuredClone(q);
  }
  recordEvent(event: QuestEvent) {
    this.entity(this.state, event.actorId);
    if (!Number.isFinite(event.at) || event.at !== this.now) throw new Error('Event time must match simulation');
    if (this.state.events.some(e => e.id === event.id)) return;
    this.state.events.push(structuredClone(event));
  }
  visit(actorId: string, locationId: string) {
    this.entity(this.state, actorId).components.geography = { locationId };
    this.recordEvent({ id: `event:visit:${randomUUID()}`, type: 'location-visited', actorId, at: this.now, facts: { locationId } });
  }
  collect(actorId: string, itemId: string) {
    const state = structuredClone(this.state); this.entity(state, actorId);
    const item = this.entity(state, itemId);
    const owner = (item.components.ownership as { ownerId?: string } | undefined)?.ownerId;
    if (owner && owner !== actorId) throw new Error('Item belongs to another actor');
    item.components.ownership = { ownerId: actorId }; item.components.placement = { kind: 'carried', actorId };
    this.state = state;
  }
  deliver(actorId: string, recipientId: string, itemDefinitionId: string, count: number) {
    const state = structuredClone(this.state); this.entity(state, actorId); this.entity(state, recipientId);
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid delivery count');
    const carried = new Set(new PrototypeInventory(state.entities, this.fixture.definitions).carried(actorId).map(e => e.id));
    const items = state.entities.filter(e => e.definitionId === itemDefinitionId && carried.has(e.id));
    if (items.length < count) throw new Error('Not enough carried items to deliver');
    for (const item of items.slice(0, count)) { item.components.ownership = { ownerId: recipientId }; item.components.placement = { kind: 'carried', actorId: recipientId }; }
    state.events.push({ id: `event:delivery:${randomUUID()}`, type: 'items-delivered', actorId, at: this.now, facts: { itemDefinitionId, recipientId, count } });
    this.state = state;
  }
  drop(actorId: string, itemId: string) {
    this.state.entities = new PrototypeInventory(this.state.entities, this.fixture.definitions).move(actorId, itemId, { kind: 'world', placeId: 'location:valley' });
  }
  private refresh(state: State, q: QuestInstance, stage: QuestStage) {
    for (const binding of stage.objectives) {
      const instance = q.objectives.find(o => o.stageId === stage.id && o.bindingId === binding.id)!;
      if (instance.completed && binding.completionMode === 'latch') continue;
      const definition = this.objectiveDefinition(instance.definitionId, instance.version);
      const result = evaluateObjective(definition, instance, q.participantId, state.entities, this.fixture.definitions, state.events);
      instance.satisfied = result.satisfied; instance.evidenceIds = result.evidenceIds;
      if (result.satisfied && !instance.completed) {
        instance.completed = true;
        state.completions.push({ id: `completion:${instance.id}`, participantId: q.participantId, objectiveDefinitionId: definition.id, objectiveVersion: definition.version, goalSignature: goalSignature(definition), completedAt: this.now, evidenceIds: result.evidenceIds });
      }
    }
  }
  check(instanceId: string) {
    const state = structuredClone(this.state), q = this.instance(state, instanceId), d = this.questDefinition(q.definitionId, q.definitionVersion);
    if (q.status === 'active') for (const id of q.activeStages) this.refresh(state, q, d.stages.find(s => s.id === id)!);
    this.state = state; return structuredClone(q);
  }
  private requirement(q: QuestInstance, stage: QuestStage, req: ObjectiveRequirement): boolean {
    if ('all' in req) return req.all.every(r => this.requirement(q, stage, r));
    if ('any' in req) return req.any.some(r => this.requirement(q, stage, r));
    const o = q.objectives.find(o => o.stageId === stage.id && o.bindingId === req.objective);
    if (!o) throw new Error('Unknown objective binding'); return o.satisfied;
  }
  advance(instanceId: string, stageId: string) {
    const state = structuredClone(this.state), q = this.instance(state, instanceId), d = this.questDefinition(q.definitionId, q.definitionVersion);
    if (q.status !== 'active' || !q.activeStages.includes(stageId)) throw new Error('Stage is not active');
    const stage = d.stages.find(s => s.id === stageId)!; this.refresh(state, q, stage);
    if (!this.requirement(q, stage, stage.requirement)) throw new Error('Objectives are not satisfied');
    q.activeStages = q.activeStages.filter(id => id !== stageId); q.completedStages.push(stageId);
    state.effects = state.effects.filter(e => !(e.provenance?.id === q.id && e.provenance.stageId === stageId && e.provenance.lifetime === 'stage'));
    for (const id of stage.next) this.activate(state, q, d.stages.find(s => s.id === id)!);
    if (!q.activeStages.length) {
      const actor = this.entity(state, q.participantId);
      for (const reward of d.rewards) {
        const receiptId = `${q.id}/reward/${reward.id}`;
        if (state.receipts.some(r => r.id === receiptId)) continue;
        if (reward.kind === 'base-attribute') {
          const attrs = actor.components.attributes as Record<string, JsonValue>;
          if (typeof attrs?.[reward.attribute] !== 'number' || !Number.isFinite(reward.amount)) throw new Error('Invalid attribute reward');
          attrs[reward.attribute] = (attrs[reward.attribute] as number) + reward.amount;
        } else if (reward.kind === 'item') {
          this.definition(reward.definitionId);
          const itemId = `${receiptId}/item`;
          const itemDefinition = this.definition(reward.definitionId);
          state.entities.push({ id: itemId, definitionId: reward.definitionId, components: { ownership: { ownerId: actor.id }, placement: reward.placementPolicy === 'carried' ? { kind: 'carried', actorId: actor.id } : { kind: 'world', placeId: ((actor.components.geography as { locationId?: string })?.locationId ?? 'location:unknown') } } });
          const provider = itemDefinition.components.effectProvider as { effects?: string[] } | undefined;
          for (const effectId of provider?.effects ?? []) {
            if (!this.fixture.effectDefinitions.some(d => d.id === effectId)) throw new Error('Unknown reward item effect');
            state.effects.push({ id: `${itemId}/effect/${effectId}`, definitionId: effectId, sourceId: q.giverId, targetId: itemId, createdAt: this.now, state: { rewardReceiptId: receiptId } });
          }
        } else {
          this.definition(reward.spellDefinitionId);
          const progress = actor.components.progression as unknown as ProgressionComponent;
          const track = progress?.classes.find(c => c.classDefinitionId === reward.classDefinitionId); if (!track) throw new Error('Reward class not present');
          if (!reward.bypassEligibility) {
            const cls = this.definition(reward.classDefinitionId).components.class as unknown as ClassDefinitionComponent;
            const option = cls.spellOptions.find(s => s.spellDefinitionId === reward.spellDefinitionId);
            if (!option || track.level < option.minimumClassLevel || !option.prerequisiteSpellIds.every(id => track.spellSelections.some(s => s.spellDefinitionId === id))) throw new Error('Reward spell requirements failed');
          }
          if (!track.spellSelections.some(s => s.spellDefinitionId === reward.spellDefinitionId)) track.spellSelections.push({ spellDefinitionId: reward.spellDefinitionId, learnedAtClassLevel: track.level, learnedAt: this.now, masteryRank: 1 });
        }
        state.receipts.push({ id: receiptId, questInstanceId: q.id, rewardId: reward.id, grantedAt: this.now }); q.rewardReceiptIds.push(receiptId);
      }
      q.status = 'completed'; state.effects = state.effects.filter(e => e.provenance?.id !== q.id);
    }
    this.state = state; return structuredClone(q);
  }
  terminate(instanceId: string, status: 'abandoned' | 'failed') {
    const state = structuredClone(this.state), q = this.instance(state, instanceId);
    if (q.status !== 'active') throw new Error('Quest is not active'); q.status = status; q.activeStages = [];
    state.effects = state.effects.filter(e => e.provenance?.id !== q.id); this.state = state;
  }
}
