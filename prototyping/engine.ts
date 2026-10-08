import fixture from './fixtures/world.json' with { type: 'json' };
import type { Entity, Definition, EffectDefinition, EffectInstance, BehaviorContext, WorldReader, JsonValue } from '../core/game/index.ts';
import { equipped, threshold, multiply, duration } from './behaviors.ts';
export class PrototypeWorld implements WorldReader {
  private entities: Entity[];
  private definitions: Definition[];
  private effectDefinitions: EffectDefinition[];
  private effects: EffectInstance[];
  private evaluating = new Set<string>();
  now = 0;
  constructor() {
    // Trusted checked-in fixture. External JSON will need runtime schema validation.
    const data = JSON.parse(JSON.stringify(fixture)) as { entities: Entity[]; definitions: Definition[]; effectDefinitions: EffectDefinition[]; effectInstances: EffectInstance[] };
    this.entities = data.entities;
    this.definitions = data.definitions;
    this.effectDefinitions = data.effectDefinitions;
    this.effects = data.effectInstances;
  }
  private requireEntity(id: string): Entity {
    const entity = this.entities.find(e => e.id === id);
    if (!entity) throw new Error(`Unknown entity: ${id}`);
    return entity;
  }
  entity(id: string) { const e = this.entities.find(e => e.id === id); return e && structuredClone(e); }
  component(id: string, name: string): JsonValue | undefined {
    const e = this.requireEntity(id);
    const d = this.definitions.find(d => d.id === e.definitionId);
    return structuredClone(e.components[name] ?? d?.components[name]);
  }
  baseAttribute(id: string, name: string): number {
    const attributes = this.component(id, 'attributes') as Record<string, JsonValue> | undefined;
    const value = attributes?.[name];
    if (typeof value !== 'number') throw new Error(`Missing numeric attribute: ${id}.${name}`);
    return value;
  }
  private context(e: EffectInstance): BehaviorContext {
    return { sourceId: e.sourceId, targetId: e.targetId, effectInstanceId: e.id, now: this.now, world: this };
  }
  effectiveAttribute(id: string, name: string): number {
    const key = `${id}/${name}`;
    if (this.evaluating.has(key)) throw new Error(`Cyclic attribute dependency: ${key}`);
    this.evaluating.add(key);
    try {
      let value = this.baseAttribute(id, name);
      for (const e of this.effects.filter(e => e.targetId === id)) {
        const d = this.effectDefinitions.find(d => d.id === e.definitionId);
        if (!d) throw new Error(`Unknown effect: ${e.definitionId}`);
        const ctx = this.context(e);
        if (d.lifetime) {
          const ref = d.lifetime;
          if (ref.id !== duration.id || ref.version !== duration.version) throw new Error('Unknown lifetime behavior');
          const seconds = ref.parameters.seconds;
          if (typeof seconds !== 'number' || seconds < 0) throw new Error('Invalid duration');
          if (duration.evaluate(ctx, { seconds }, e).expired) continue;
        }
        // Select contributions first: irrelevant effects must not introduce false cycles.
        for (const ref of d.contributions) {
          if (ref.id !== multiply.id || ref.version !== multiply.version) throw new Error('Unknown contribution behavior');
          const { attribute, factor } = ref.parameters;
          if (typeof attribute !== 'string' || typeof factor !== 'number' || !Number.isFinite(factor)) throw new Error('Invalid multiplier');
          if (attribute !== name) continue;
          const active = d.conditions.every(ref => {
            if (ref.version !== 1) throw new Error('Unknown condition version');
            if (ref.id === equipped.id) return equipped.evaluate(ctx, {}).satisfied;
            if (ref.id === threshold.id) {
              const { attribute, minimum } = ref.parameters;
              if (typeof attribute !== 'string' || typeof minimum !== 'number') throw new Error('Invalid threshold');
              return threshold.evaluate(ctx, { attribute, minimum }).satisfied;
            }
            throw new Error(`Unknown condition: ${ref.id}`);
          });
          if (active) for (const modifier of multiply.evaluate(ctx, { attribute, factor }).modifiers) value *= modifier.value;
        }
      }
      return value;
    } finally { this.evaluating.delete(key); }
  }
  inventory(actorId: string) {
    return this.entities.filter(e => (e.components.ownership as Record<string, JsonValue> | undefined)?.ownerId === actorId)
      .map(e => ({ id: e.id, name: this.definitions.find(d => d.id === e.definitionId)!.name }));
  }
  stats(actorId: string) { return { strength: this.effectiveAttribute(actorId, 'strength'), intelligence: this.effectiveAttribute(actorId, 'intelligence') }; }
  equip(actorId: string, itemId: string) {
    const item = this.requireEntity(itemId);
    if ((item.components.ownership as Record<string, JsonValue>)?.ownerId !== actorId) throw new Error('Item is not owned by actor');
    const slots = (this.component(itemId, 'equippable') as { slots?: JsonValue[] } | undefined)?.slots;
    if (!slots?.includes('finger')) throw new Error('Item cannot be equipped on finger');
    this.requireEntity(actorId).components.equipment = { finger: itemId };
  }
  unequip(actorId: string) { this.requireEntity(actorId).components.equipment = {}; }
  readScroll(actorId: string, itemId: string) {
    const item = this.requireEntity(itemId);
    if ((item.components.ownership as Record<string, JsonValue>)?.ownerId !== actorId) throw new Error('Item is not owned by actor');
    const use = this.component(itemId, 'consumable') as { effectDefinitionId?: string } | undefined;
    if (!use?.effectDefinitionId || !this.effectDefinitions.some(d => d.id === use.effectDefinitionId)) throw new Error('Item is not a usable scroll');
    this.requireEntity(actorId);
    // All validation precedes this in-memory commit. No production transaction engine yet.
    this.effects.push({ id: `effect:scroll:${itemId}`, definitionId: use.effectDefinitionId, sourceId: itemId, targetId: actorId, createdAt: this.now, state: {} });
    this.entities = this.entities.filter(e => e.id !== itemId);
  }
  advance(seconds: number) { if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid time advance'); this.now += seconds; }
}
