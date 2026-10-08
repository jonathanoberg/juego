import { randomUUID } from 'node:crypto';
import fixture from './fixtures/world.json' with { type: 'json' };
import type { Entity, Definition, EffectDefinition, EffectInstance, BehaviorContext, WorldReader, JsonValue, ClassDefinitionComponent, ClassProgress, ProgressionComponent, SpellAvailability, ArmorComponent, EquippableComponent, WorldChange, RandomSource } from '../core/game/index.ts';
import { equipped, threshold, multiply, duration, allowedArmor, descriptionFragment } from './behaviors.ts';
import { swordAttack, susceptibleMultiplier } from './combat-behaviors.ts';
import type { AttackInput, AttackModifier, WeaponComponent } from '../core/game/combat.ts';
import { PrototypeInventory } from './inventory.ts';
import type { Placement } from '../core/game/inventory.ts';
import { eatFood, cleanItem } from './status-actions.ts';
export interface PrototypeFixture { entities: Entity[]; definitions: Definition[]; effectDefinitions: EffectDefinition[]; effectInstances: EffectInstance[]; }
export class PrototypeWorld implements WorldReader {
  private entities: Entity[];
  private definitions: Definition[];
  private effectDefinitions: EffectDefinition[];
  private effects: EffectInstance[];
  private evaluating = new Set<string>();
  now = 0;
  private random: RandomSource;
  private nextEffectId = 1;
  private eventLog: import('../core/game/personality.ts').WorldEvent[] = [];
  events() { return structuredClone(this.eventLog); }
  constructor(input: PrototypeFixture = JSON.parse(JSON.stringify(fixture)) as PrototypeFixture, privateRandom: RandomSource = { next: () => Math.random() }) {
    this.random = privateRandom;
    // Trusted checked-in fixture. External JSON will need runtime schema validation.
    const data = structuredClone(input);
    this.entities = new PrototypeInventory(data.entities, data.definitions).snapshot();
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
        if (this.expired(e, d)) continue;
        // Select contributions first: irrelevant effects must not introduce false cycles.
        for (const ref of d.contributions) {
          if (ref.id === descriptionFragment.id && ref.version === descriptionFragment.version) continue;
          if (ref.id !== multiply.id || ref.version !== multiply.version) throw new Error('Unknown contribution behavior');
          const { attribute, factor } = ref.parameters;
          if (typeof attribute !== 'string' || typeof factor !== 'number' || !Number.isFinite(factor)) throw new Error('Invalid multiplier');
          if (attribute !== name) continue;
          const active = this.predicatesSatisfied(e, d);
          if (active) for (const modifier of multiply.evaluate(ctx, { attribute, factor }).modifiers) value *= modifier.value;
        }
      }
      return value;
    } finally { this.evaluating.delete(key); }
  }
  private expired(e: EffectInstance, d: EffectDefinition): boolean {
    if (!d.lifetime) return false;
    const ref = d.lifetime;
    if (ref.id !== duration.id || ref.version !== duration.version) throw new Error('Unknown lifetime behavior');
    const seconds = ref.parameters.seconds;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid duration');
    return duration.evaluate(this.context(e), { seconds }, e).expired;
  }
  private predicatesSatisfied(e: EffectInstance, d: EffectDefinition): boolean {
    const ctx = this.context(e);
    return d.predicates.every(ref => {
      if (ref.version !== 1) throw new Error('Unknown predicate version');
      if (ref.id === equipped.id) return equipped.evaluate(ctx, {}).satisfied;
      if (ref.id === threshold.id) {
        const { attribute, minimum } = ref.parameters;
        if (typeof attribute !== 'string' || typeof minimum !== 'number') throw new Error('Invalid threshold');
        return threshold.evaluate(ctx, { attribute, minimum }).satisfied;
      }
      throw new Error(`Unknown predicate: ${ref.id}`);
    });
  }
  effectDefinition(id: string) {
    const d = this.effectDefinitions.find(d => d.id === id);
    return d && { id: d.id, tags: structuredClone(d.tags ?? []) };
  }
  effectsOn(id: string): EffectInstance[] {
    this.requireEntity(id);
    return structuredClone(this.effects.filter(e => {
      if (e.targetId !== id) return false;
      const d = this.effectDefinitions.find(d => d.id === e.definitionId);
      if (!d) throw new Error(`Unknown effect: ${e.definitionId}`);
      return !this.expired(e, d) && this.predicatesSatisfied(e, d);
    }));
  }
  describe(id: string): string {
    const entity = this.requireEntity(id);
    const base = this.definitions.find(d => d.id === entity.definitionId)?.name ?? id;
    const fragments: string[] = [];
    for (const e of this.effectsOn(id)) {
      const d = this.effectDefinitions.find(d => d.id === e.definitionId)!;
      for (const ref of d.contributions) {
        if (ref.id === multiply.id && ref.version === multiply.version) continue;
        if (ref.id !== descriptionFragment.id || ref.version !== descriptionFragment.version) throw new Error('Unknown description contribution');
        const text = ref.parameters.text;
        if (typeof text !== 'string') throw new Error('Invalid description fragment');
        for (const fragment of descriptionFragment.evaluate(this.context(e), { text }).descriptions ?? []) fragments.push(fragment.text);
      }
    }
    return [base, ...new Set(fragments)].join(', ');
  }
  private commit(changes: WorldChange[]) {
    // Stage all supported operations before swapping state. No callbacks during commit.
    let entities = structuredClone(this.entities);
    let effects = structuredClone(this.effects);
    let nextId = this.nextEffectId;
    for (const change of changes) {
      if (change.kind === 'applyDamage') {
        const target = entities.find(e => e.id === change.targetId);
        const health = target?.components.health as { current?: number } | undefined;
        if (!health || typeof health.current !== 'number' || !Number.isFinite(change.amount) || change.amount < 0) throw new Error('Invalid damage operation');
        target!.components.health = { ...health, current: Math.max(0, health.current - change.amount) };
      } else if (change.kind === 'removeEffect') {
        if (!effects.some(e => e.id === change.effectInstanceId)) throw new Error('Missing effect to remove');
        effects = effects.filter(e => e.id !== change.effectInstanceId);
      } else if (change.kind === 'consumeItem') {
        if (change.quantity !== 1 || !entities.some(e => e.id === change.entityId)) throw new Error('Invalid consumption');
        entities = entities.filter(e => e.id !== change.entityId);
      } else if (change.kind === 'attachEffect') {
        if (!this.effectDefinitions.some(d => d.id === change.definitionId) || !entities.some(e => e.id === change.targetId)) throw new Error('Invalid effect attachment');
        if (!this.entities.some(e => e.id === change.sourceId)) throw new Error('Missing effect source');
        let id: string;
        do { id = `effect:action:${nextId++}`; } while (effects.some(e => e.id === id));
        effects.push({ id, definitionId: change.definitionId, sourceId: change.sourceId, targetId: change.targetId, createdAt: this.now, state: {} });
      }
    }
    this.entities = entities; this.effects = effects; this.nextEffectId = nextId;
  }
  attack(input: AttackInput) {
    const weapon = this.component(input.weaponId, 'weapon') as unknown as WeaponComponent | undefined;
    if (!weapon || weapon.attackBehavior.id !== swordAttack.id || weapon.attackBehavior.version !== swordAttack.version) throw new Error('Unknown weapon attack behavior');
    const ctx = { sourceId: input.weaponId, targetId: input.targetId, now: this.now, world: this, random: this.random };
    const modifiers: AttackModifier[] = [];
    for (const effect of this.effectsOn(input.weaponId)) {
      const definition = this.effectDefinitions.find(d => d.id === effect.definitionId)!;
      for (const ref of definition.attackContributions ?? []) {
        if (ref.id !== susceptibleMultiplier.id || ref.version !== susceptibleMultiplier.version) throw new Error('Unknown attack contribution');
        const { tag, factor } = ref.parameters;
        if (typeof tag !== 'string' || typeof factor !== 'number') throw new Error('Invalid attack contribution parameters');
        modifiers.push(...susceptibleMultiplier.evaluate(ctx, { tag, factor }, input).modifiers);
      }
    }
    const result = swordAttack.execute(ctx, {}, input, modifiers);
    if (!result.accepted) throw new Error(result.reason);
    const traits = this.component(input.targetId, 'traits') as { tags?: string[] } | undefined;
    const facts = { targetTags: [...(traits?.tags ?? [])], hit: result.outcome.hit, damage: result.outcome.damage };
    this.commit(result.changes);
    this.eventLog.push({ id: `event:attack:${randomUUID()}`, type: 'attack-resolved', at: this.now, actorId: input.actorId, weaponId: input.weaponId, targetId: input.targetId, facts });
    return result.outcome;
  }
  activateSwordFlame(actorId: string, weaponId: string) {
    const ownership = this.component(weaponId, 'ownership') as { ownerId?: string } | undefined;
    const equipment = this.component(actorId, 'equipment') as Record<string, string> | undefined;
    if (ownership?.ownerId !== actorId || equipment?.hand !== weaponId) throw new Error('Flame requires an owned sword in hand');
    const weapon = this.component(weaponId, 'weapon') as unknown as WeaponComponent | undefined;
    if (!weapon || weapon.attackBehavior.id !== swordAttack.id) throw new Error('Flame requires a sword');
    const progress = this.progression(actorId);
    if (!progress.classes.some(c => c.spellSelections.some(s => s.spellDefinitionId === 'spell:flame'))) throw new Error('Flame spell has not been learned');
    if (this.effectsOn(weaponId).some(e => e.definitionId === 'effect:sword-flame')) throw new Error('Flame is already active');
    this.commit([{ kind: 'attachEffect', definitionId: 'effect:sword-flame', sourceId: actorId, targetId: weaponId }]);
  }
  eat(actorId: string, foodId: string) {
    this.requireEntity(actorId);
    const result = eatFood.execute({ sourceId: foodId, targetId: actorId, now: this.now, world: this, random: this.random }, {}, {});
    if (!result.accepted) throw new Error(result.reason);
    this.commit(result.changes);
  }
  clean(actorId: string, soapId: string, itemId: string) {
    this.requireEntity(actorId);
    const result = cleanItem.execute({ sourceId: soapId, targetId: actorId, now: this.now, world: this }, {}, { itemId });
    if (!result.accepted) throw new Error(result.reason);
    this.commit(result.changes);
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
    const occupied = this.component(actorId, 'equipment') as Record<string, JsonValue> | undefined;
    const staged = new PrototypeInventory(this.entities, this.definitions);
    if (typeof occupied?.[selectedSlot] === 'string' && occupied[selectedSlot] !== itemId) {
      const moved = staged.move(actorId, occupied[selectedSlot] as string, { kind: 'carried', actorId });
      this.entities = new PrototypeInventory(moved, this.definitions).move(actorId, itemId, { kind: 'equipped', actorId, slot: selectedSlot });
    } else this.entities = staged.move(actorId, itemId, { kind: 'equipped', actorId, slot: selectedSlot });
  }
  unequip(actorId: string, slot = 'finger') {
    const equipment = this.component(actorId, 'equipment') as Record<string, JsonValue> | undefined;
    const itemId = equipment?.[slot];
    if (typeof itemId === 'string') this.moveItem(actorId, itemId, { kind: 'carried', actorId });
  }
  moveItem(actorId: string, itemId: string, destination: Placement) {
    if (destination.kind === 'equipped') throw new Error('Use equip for equipment validation');
    this.entities = new PrototypeInventory(this.entities, this.definitions).move(actorId, itemId, destination);
  }
  directContents(containerId: string, compartmentId?: string) {
    return new PrototypeInventory(this.entities, this.definitions).directContents(containerId, compartmentId);
  }
  carriedInventory(actorId: string) {
    return new PrototypeInventory(this.entities, this.definitions).carried(actorId);
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
