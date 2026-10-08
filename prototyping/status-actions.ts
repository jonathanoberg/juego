import type { ActionBehavior, BehaviorContext, JsonValue, WorldChange } from '../core/game/index.ts';
function owned(ctx: BehaviorContext, id: string): boolean {
  if (!ctx.world.entity(id)) return false;
  const ownership = ctx.world.component(id, 'ownership') as Readonly<Record<string, JsonValue>> | undefined;
  return ownership?.ownerId === ctx.targetId;
}
function effectsMatching(ctx: BehaviorContext, target: string, tags: readonly string[]) {
  return ctx.world.effectsOn(target).filter(e => {
    const definition = ctx.world.effectDefinition(e.definitionId);
    return tags.every(tag => definition?.tags?.includes(tag));
  });
}
export const eatFood: ActionBehavior<Record<string, never>, Record<string, never>> = {
  id: 'eat-food', version: 1, role: 'action', parameterSchema: { type: 'object' },
  execute(ctx) {
    if (!owned(ctx, ctx.sourceId)) return { accepted: false, reason: 'Food is not owned by actor' };
    const food = ctx.world.component(ctx.sourceId, 'food') as unknown as { satisfiesTags: string[]; spillChance: number; spillEffectDefinitionId: string } | undefined;
    if (!food) return { accepted: false, reason: 'Item is not food' };
    if (!Number.isFinite(food.spillChance) || food.spillChance < 0 || food.spillChance > 1) throw new Error('Invalid spill probability');
    if (!ctx.world.effectDefinition(food.spillEffectDefinitionId)) throw new Error('Unknown spill effect');
    const changes: WorldChange[] = effectsMatching(ctx, ctx.targetId, food.satisfiesTags).map(e => ({ kind: 'removeEffect', effectInstanceId: e.id }));
    changes.push({ kind: 'consumeItem', entityId: ctx.sourceId, quantity: 1 });
    const equipment = ctx.world.component(ctx.targetId, 'equipment') as Readonly<Record<string, string>> | undefined;
    const garment = equipment?.body;
    if (garment) {
      if (!ctx.world.entity(garment)) throw new Error('Missing worn garment');
      if (!ctx.random) throw new Error('Eating requires engine-supplied randomness');
      const roll = ctx.random.next();
      if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error('Invalid random sample');
      if (roll < food.spillChance) changes.push({ kind: 'attachEffect', definitionId: food.spillEffectDefinitionId, sourceId: ctx.sourceId, targetId: garment });
    }
    return { accepted: true, changes };
  }
};
export const cleanItem: ActionBehavior<Record<string, never>, { itemId: string }> = {
  id: 'clean-item', version: 1, role: 'action', parameterSchema: { type: 'object' },
  execute(ctx, _p, input) {
    if (!owned(ctx, ctx.sourceId) || !owned(ctx, input.itemId)) return { accepted: false, reason: 'Soap and target must be owned by actor' };
    const cleaning = ctx.world.component(ctx.sourceId, 'cleaning') as unknown as { removesTags: string[] } | undefined;
    if (!cleaning) return { accepted: false, reason: 'Item is not a cleaning supply' };
    const matches = effectsMatching(ctx, input.itemId, cleaning.removesTags);
    if (!matches.length) return { accepted: false, reason: 'No removable stains' };
    return { accepted: true, changes: [
      ...matches.map(e => ({ kind: 'removeEffect' as const, effectInstanceId: e.id })),
      { kind: 'consumeItem', entityId: ctx.sourceId, quantity: 1 }
    ] };
  }
};
