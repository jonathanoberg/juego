export type EntityId = string;
export type WorldTime = number; // Simulation seconds, supplied by the engine.
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Components = Record<string, JsonValue>;
export interface Definition { id: string; name: string; components: Components; }
export interface Entity { id: EntityId; definitionId: string; components: Components; }
export interface BehaviorReference { id: string; version: number; parameters: Record<string, JsonValue>; }
export interface EffectDefinition {
  id: string;
  tags?: string[];
  predicates: BehaviorReference[]; // All must be satisfied.
  contributions: BehaviorReference[];
  attackContributions?: BehaviorReference[];
  lifetime?: BehaviorReference;
}
export interface EffectInstance {
  id: string; definitionId: string; sourceId: EntityId; targetId: EntityId;
  createdAt: WorldTime; state: Record<string, JsonValue>;
}
export type ReadonlyJsonValue = null | boolean | number | string | readonly ReadonlyJsonValue[] | { readonly [key: string]: ReadonlyJsonValue };
export interface EntityView { readonly id: EntityId; readonly definitionId: string; readonly components: Readonly<Record<string, ReadonlyJsonValue>>; }
export interface EffectInstanceView { readonly id: string; readonly definitionId: string; readonly sourceId: EntityId; readonly targetId: EntityId; readonly createdAt: WorldTime; readonly state: Readonly<Record<string, ReadonlyJsonValue>>; }
export interface EffectDefinitionView { readonly id: string; readonly tags?: readonly string[]; }
export interface RandomSource { next(): number; } // Engine-supplied value in [0, 1).
export interface WorldReader {
  effectsOn(id: EntityId): readonly EffectInstanceView[]; // Currently active effects.
  effectDefinition(id: string): EffectDefinitionView | undefined;
  entity(id: EntityId): EntityView | undefined;
  baseAttribute(id: EntityId, name: string): number;
  effectiveAttribute(id: EntityId, name: string): number;
  component(id: EntityId, name: string): ReadonlyJsonValue | undefined;
}
export interface BehaviorContext {
  sourceId: EntityId; targetId: EntityId; effectInstanceId?: string;
  now: WorldTime; world: WorldReader; random?: RandomSource;
}
export interface BehaviorMetadata {
  id: string; version: number;
  parameterSchema: Record<string, JsonValue>; // JSON Schema; runtime validation is engine-owned.
}
export interface PredicateResult { satisfied: boolean; reason?: string; }
export interface PredicateBehavior<P> extends BehaviorMetadata {
  role: 'predicate'; evaluate(context: BehaviorContext, parameters: Readonly<P>): PredicateResult;
}
export interface AttributeModifier {
  targetId: EntityId; attribute: string; operation: 'add' | 'multiply' | 'override'; value: number;
}
export interface DescriptionFragment { targetId: EntityId; text: string; }
export interface ContributionResult { modifiers: AttributeModifier[]; descriptions?: DescriptionFragment[]; }
export interface ContributionBehavior<P> extends BehaviorMetadata {
  role: 'contribution'; evaluate(context: BehaviorContext, parameters: Readonly<P>): ContributionResult;
}
export type WorldChange =
  | { kind: 'attachEffect'; definitionId: string; sourceId: EntityId; targetId: EntityId }
  | { kind: 'consumeItem'; entityId: EntityId; quantity: number }
  | { kind: 'removeEffect'; effectInstanceId: string }
  | { kind: 'applyDamage'; targetId: EntityId; amount: number; damageType: string };
export type ActionResult = { accepted: false; reason: string } | { accepted: true; changes: WorldChange[] };
export interface ActionBehavior<P, I> extends BehaviorMetadata {
  role: 'action'; execute(context: BehaviorContext, parameters: Readonly<P>, input: Readonly<I>): ActionResult;
}
export interface LifetimeResult { expired: boolean; nextCheckAt?: WorldTime; }
export interface LifetimeBehavior<P> extends BehaviorMetadata {
  role: 'lifetime'; evaluate(context: BehaviorContext, parameters: Readonly<P>, instance: EffectInstanceView): LifetimeResult;
}

export type { ClassDefinitionComponent, ClassProgress, ProgressionComponent, SpellDefinitionComponent, SpellSelection, ArmorComponent, EquippableComponent, SpellAvailability } from './progression.ts';

export type { PhysicalComponent, ContainerComponent, Placement, AdmissionBehavior, AdmissionContext } from './inventory.ts';

export type { AttackInput, WeaponComponent, AttackModifier, AttackOutcome, AttackResult, AttackBehavior, AttackContributionBehavior } from './combat.ts';
