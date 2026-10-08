import type { AttackBehavior, AttackContributionBehavior, WeaponComponent } from '../core/game/combat.ts';
import type { ArmorComponent } from '../core/game/progression.ts';
import type { BehaviorContext } from '../core/game/index.ts';
function draw(ctx: BehaviorContext) {
  if (!ctx.random) throw new Error('Combat requires engine-supplied randomness');
  const n = ctx.random.next();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error('Invalid random sample');
  return n;
}
export const susceptibleMultiplier: AttackContributionBehavior<{ tag: string; factor: number }> = {
  id: 'susceptible-damage-multiplier', version: 1, role: 'attack-contribution', parameterSchema: { type: 'object' },
  evaluate(ctx, p, attack) {
    if (!Number.isFinite(p.factor) || p.factor < 0) throw new Error('Invalid damage multiplier');
    const tags = ctx.world.component(attack.targetId, 'traits') as { tags?: readonly string[] } | undefined;
    return { modifiers: tags?.tags?.includes(p.tag) ? [{ operation: 'multiply-damage', factor: p.factor }] : [] };
  }
};
export const swordAttack: AttackBehavior<Record<string, never>> = {
  id: 'sword-attack', version: 1, role: 'action', parameterSchema: { type: 'object' },
  execute(ctx, _p, attack, modifiers) {
    const { actorId, weaponId, targetId } = attack;
    if (actorId === targetId) return { accepted: false, reason: 'Cannot attack self in prototype' };
    if (!ctx.world.entity(actorId) || !ctx.world.entity(weaponId) || !ctx.world.entity(targetId)) return { accepted: false, reason: 'Missing attack participant' };
    const equipment = ctx.world.component(actorId, 'equipment') as Record<string, string> | undefined;
    if (equipment?.hand !== weaponId) return { accepted: false, reason: 'Weapon must be equipped in hand' };
    const ownership = ctx.world.component(weaponId, 'ownership') as { ownerId?: string } | undefined;
    if (ownership?.ownerId !== actorId) return { accepted: false, reason: 'Weapon is not owned by actor' };
    const health = ctx.world.component(targetId, 'health') as { current?: number } | undefined;
    if (typeof health?.current !== 'number' || !Number.isFinite(health.current) || health.current <= 0) return { accepted: false, reason: 'Target is not alive' };
    const actorHealth = ctx.world.component(actorId, 'health') as { current?: number } | undefined;
    if (typeof actorHealth?.current !== 'number' || !Number.isFinite(actorHealth.current) || actorHealth.current <= 0) return { accepted: false, reason: 'Actor is not alive' };
    const weapon = ctx.world.component(weaponId, 'weapon') as unknown as WeaponComponent | undefined;
    if (!weapon) return { accepted: false, reason: 'Item is not a weapon' };
    const { minimum, maximum, type } = weapon.damage;
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum < minimum) throw new Error('Invalid weapon damage range');
    const skills = ctx.world.component(actorId, 'skills') as Record<string, number> | undefined;
    const defenses = ctx.world.component(targetId, 'skills') as Record<string, number> | undefined;
    const skill = skills?.[weapon.skillId] ?? 0, dodge = defenses?.dodge ?? 0;
    if (!Number.isFinite(skill) || !Number.isFinite(dodge)) throw new Error('Invalid combat skill');
    let reduceHit = 0, reduceDamage = 0;
    const worn = ctx.world.component(targetId, 'equipment') as Record<string, string> | undefined;
    for (const id of new Set(Object.values(worn ?? {}))) {
      const armor = ctx.world.component(id, 'armor') as unknown as ArmorComponent | undefined;
      if (!armor) continue;
      if (!Number.isFinite(armor.reduceHit) || armor.reduceHit < 0 || !Number.isFinite(armor.reduceDamage) || armor.reduceDamage < 0) throw new Error('Invalid armor defenses');
      reduceHit += armor.reduceHit; reduceDamage += armor.reduceDamage;
    }
    const hitChance = Math.max(0.05, Math.min(0.95, 0.75 + (skill - dodge) * 0.02 - reduceHit));
    const hitRoll = draw(ctx), hit = hitRoll < hitChance;
    const multiplier = modifiers.reduce((value, m) => {
      if (!Number.isFinite(m.factor) || m.factor < 0) throw new Error('Invalid damage multiplier');
      return value * m.factor;
    }, 1);
    const rolledDamage = hit ? minimum + Math.floor(draw(ctx) * (maximum - minimum + 1)) : 0;
    const damage = hit ? Math.max(0, rolledDamage * multiplier - reduceDamage) : 0;
    if (!Number.isFinite(damage)) throw new Error('Invalid calculated damage');
    return { accepted: true, outcome: { hit, hitChance, hitRoll, damageType: type, rolledDamage, damageMultiplier: multiplier, armorReduction: reduceDamage, damage },
      changes: hit ? [{ kind: 'applyDamage', targetId, amount: damage, damageType: type }] : [] };
  }
};
