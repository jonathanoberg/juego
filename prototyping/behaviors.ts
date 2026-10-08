import type { PredicateBehavior, ContributionBehavior, LifetimeBehavior } from '../core/game/index.ts';
const objectSchema = { type: 'object' };
export const equipped: PredicateBehavior<Record<string, never>> = {
  id: 'equipped', version: 1, role: 'predicate', parameterSchema: objectSchema,
  evaluate(ctx) {
    const slots = ctx.world.component(ctx.targetId, 'equipment') as Readonly<Record<string, string>> | undefined;
    return { satisfied: Object.values(slots ?? {}).includes(ctx.sourceId) };
  }
};
export const threshold: PredicateBehavior<{ attribute: string; minimum: number }> = {
  id: 'attribute-threshold', version: 1, role: 'predicate', parameterSchema: objectSchema,
  evaluate(ctx, p) { return { satisfied: ctx.world.effectiveAttribute(ctx.targetId, p.attribute) >= p.minimum }; }
};
export const multiply: ContributionBehavior<{ attribute: string; factor: number }> = {
  id: 'multiply-attribute', version: 1, role: 'contribution', parameterSchema: objectSchema,
  evaluate(ctx, p) { return { modifiers: [{ targetId: ctx.targetId, attribute: p.attribute, operation: 'multiply', value: p.factor }] }; }
};
export const duration: LifetimeBehavior<{ seconds: number }> = {
  id: 'duration', version: 1, role: 'lifetime', parameterSchema: objectSchema,
  evaluate(ctx, p, instance) {
    const expiresAt = instance.createdAt + p.seconds;
    return { expired: ctx.now >= expiresAt, nextCheckAt: expiresAt };
  }
};

export const allowedArmor: PredicateBehavior<{ allowedCategories: string[]; category: string }> = {
  id: 'allowed-armor-categories', version: 1, role: 'predicate', parameterSchema: objectSchema,
  evaluate(_ctx, p) {
    const satisfied = p.allowedCategories.includes(p.category);
    return { satisfied, reason: satisfied ? undefined : `Class does not allow armor category: ${p.category}` };
  }
};

export const descriptionFragment: ContributionBehavior<{ text: string }> = {
  id: 'description-fragment', version: 1, role: 'contribution', parameterSchema: objectSchema,
  evaluate(ctx, p) { return { modifiers: [], descriptions: [{ targetId: ctx.targetId, text: p.text }] }; }
};
