import type { BehaviorContext, BehaviorMetadata, BehaviorReference, EntityId, WorldChange } from './index.ts';
export interface AttackInput { actorId: EntityId; weaponId: EntityId; targetId: EntityId; }
export interface WeaponComponent {
  attackBehavior: BehaviorReference;
  skillId: string;
  damage: { minimum: number; maximum: number; type: string };
}
export interface AttackModifier { operation: 'multiply-damage'; factor: number; }
export interface AttackContributionBehavior<P> extends BehaviorMetadata {
  role: 'attack-contribution';
  evaluate(context: BehaviorContext, parameters: Readonly<P>, attack: Readonly<AttackInput>): { modifiers: AttackModifier[] };
}
export interface AttackOutcome {
  hit: boolean; hitChance: number; hitRoll: number; damageType: string;
  rolledDamage: number; damageMultiplier: number; armorReduction: number; damage: number;
}
export type AttackResult =
  | { accepted: false; reason: string }
  | { accepted: true; outcome: AttackOutcome; changes: WorldChange[] };
export interface AttackBehavior<P> extends BehaviorMetadata {
  role: 'action';
  execute(context: BehaviorContext, parameters: Readonly<P>, attack: Readonly<AttackInput>, modifiers: readonly AttackModifier[]): AttackResult;
}
