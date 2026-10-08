import fixture from './fixtures/world.json' with { type: 'json' };
import type { Entity, Definition, EffectDefinition, EffectInstance, BehaviorContext, WorldReader, JsonValue, ClassDefinitionComponent, ClassProgress, ProgressionComponent, SpellAvailability, ArmorComponent, EquippableComponent } from '../core/game/index.ts';
import { equipped, threshold, multiply, duration, allowedArmor } from './behaviors.ts';
export interface PrototypeFixture { entities: Entity[]; definitions: Definition[]; effectDefinitions: EffectDefinition[]; effectInstances: EffectInstance[]; }
export class PrototypeWorld implements WorldReader {
  private entities: Entity[];
  private definitions: Definition[];
  private effectDefinitions: EffectDefinition[];
  private effects: EffectInstance[];
  private evaluating = new Set<string>();
  now = 0;
  constructor(input: PrototypeFixture = JSON.parse(JSON.stringify(fixture)) as PrototypeFixture) {
    // Trusted checked-in fixture. External JSON will need runtime schema validation.
    const data = structuredClone(input);
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
  private classDefinition(id: string): ClassDefinitionComponent {
    const component = this.definitions.find(d => d.id === id)?.components.class;
    if (!component) throw new Error(`Unknown class definition: ${id}`);
    return structuredClone(component) as unknown as ClassDefinitionComponent;
  }
  progression(actorId: string): ProgressionComponent {
    return (this.component(actorId, 'progression') ?? { classes: [] }) as unknown as ProgressionComponent;
  }
  private classProgress(actorId: string, classId: string): ClassProgress {
    const progress = this.progression(actorId).classes.find(c => c.classDefinitionId === classId);
    if (!progress) throw new Error(`Actor does not belong to class: ${classId}`);
    return progress;
  }
  availableSpells(actorId: string, classId: string): SpellAvailability[] {
    const progress = this.classProgress(actorId, classId);
    return this.classDefinition(classId).spellOptions.map(option => {
      const learned = progress.spellSelections.some(s => s.spellDefinitionId === option.spellDefinitionId);
      const reasons: string[] = [];
      if (learned) reasons.push('Already learned');
      if (progress.level < option.minimumClassLevel) reasons.push(`Requires class level ${option.minimumClassLevel}`);
      for (const id of option.prerequisiteSpellIds) {
        if (!progress.spellSelections.some(s => s.spellDefinitionId === id)) reasons.push(`Requires spell ${id}`);
      }
      return { spellDefinitionId: option.spellDefinitionId, learned, learnable: reasons.length === 0, reasons };
    });
  }
  learnSpell(actorId: string, classId: string, spellId: string) {
    const option = this.availableSpells(actorId, classId).find(s => s.spellDefinitionId === spellId);
    if (!option) throw new Error('Spell is not offered by this class');
    if (!option.learnable) throw new Error(option.reasons.join('; '));
    if (!this.definitions.some(d => d.id === spellId && d.components.spell)) throw new Error('Unknown spell definition');
    const progression = this.progression(actorId);
    const progress = progression.classes.find(c => c.classDefinitionId === classId)!;
    progress.spellSelections.push({ spellDefinitionId: spellId, learnedAtClassLevel: progress.level, learnedAt: this.now, masteryRank: 1 });
    this.requireEntity(actorId).components.progression = progression as unknown as JsonValue;
  }
  // Prototype/admin action: no experience-point or advancement-cost system yet.
  advanceClassLevel(actorId: string, classId: string) {
    const progression = this.progression(actorId);
    const progress = progression.classes.find(c => c.classDefinitionId === classId);
    if (!progress) throw new Error(`Actor does not belong to class: ${classId}`);
    if (progress.level >= this.classDefinition(classId).maximumLevel) throw new Error('Maximum class level reached');
    progress.level += 1;
    progress.achievedLevels.push({ level: progress.level, achievedAt: this.now });
    this.requireEntity(actorId).components.progression = progression as unknown as JsonValue;
  }
  equip(actorId: string, itemId: string, slot?: string) {
    const item = this.requireEntity(itemId);
    if ((item.components.ownership as Record<string, JsonValue>)?.ownerId !== actorId) throw new Error('Item is not owned by actor');
    const equippable = this.component(itemId, 'equippable') as unknown as EquippableComponent | undefined;
    const selectedSlot = slot ?? equippable?.slots[0];
    if (!selectedSlot || !equippable?.slots.includes(selectedSlot)) throw new Error('Item cannot be equipped in requested slot');
    const armor = this.component(itemId, 'armor') as unknown as ArmorComponent | undefined;
    if (armor) {
      for (const progress of this.progression(actorId).classes) {
        for (const rule of this.classDefinition(progress.classDefinitionId).equipmentRules) {
          if (rule.id !== allowedArmor.id || rule.version !== allowedArmor.version) throw new Error('Unknown equipment rule');
          const categories = rule.parameters.allowedCategories;
          if (!Array.isArray(categories) || !categories.every(c => typeof c === 'string')) throw new Error('Invalid armor categories');
          const result = allowedArmor.evaluate({ sourceId: itemId, targetId: actorId, now: this.now, world: this }, { allowedCategories: categories as string[], category: armor.category });
          if (!result.satisfied) throw new Error(result.reason);
        }
      }
    }
    const equipment = this.component(actorId, 'equipment') as Record<string, JsonValue> | undefined;
    this.requireEntity(actorId).components.equipment = { ...equipment, [selectedSlot]: itemId };
  }
  unequip(actorId: string, slot = 'finger') {
    const equipment = this.component(actorId, 'equipment') as Record<string, JsonValue> | undefined;
    const next = { ...equipment }; delete next[slot];
    this.requireEntity(actorId).components.equipment = next;
  }
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
