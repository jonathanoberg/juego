import type { AdmissionBehavior, AdmissionContext } from '../core/game/inventory.ts';
import type { BehaviorReference, JsonValue, PredicateResult } from '../core/game/index.ts';
function result(ok: boolean, reason: string): PredicateResult { return { satisfied: ok, reason: ok ? undefined : reason }; }
function number(value: JsonValue | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid rule number');
  return value;
}
function strings(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) throw new Error('Invalid rule tags');
  return value as string[];
}
const metadata = { version: 1, role: 'predicate' as const, parameterSchema: { type: 'object' } };
export const entityCount: AdmissionBehavior<{ maximum: number }> = {
  ...metadata, id: 'entity-count', evaluate: (ctx, p) => result(ctx.items.length <= p.maximum, 'Too many entities')
};
export const itemTags: AdmissionBehavior<{ require: string[]; reject: string[] }> = {
  ...metadata, id: 'item-tags', evaluate: (ctx, p) => result(ctx.items.every(i =>
    p.require.every(t => i.physical?.tags.includes(t)) && !p.reject.some(t => i.physical?.tags.includes(t))), 'Item type is not admitted')
};
export const sizeBudget: AdmissionBehavior<{ capacity: number; costs: Record<string, number> }> = {
  ...metadata, id: 'size-budget', evaluate(ctx, p) {
    let used = 0;
    for (const item of ctx.items) {
      const category = item.physical?.sizeClass;
      const cost = category === undefined ? undefined : p.costs[category];
      if (cost === undefined) return result(false, 'Size class is unknown or not admitted');
      used += cost;
    }
    return result(used <= p.capacity, 'Size capacity exceeded');
  }
};
export const maximumLength: AdmissionBehavior<{ exclusiveMeters: number }> = {
  ...metadata, id: 'maximum-length', evaluate(ctx, p) {
    for (const item of ctx.items) {
      const length = item.physical?.dimensions?.lengthMeters;
      if (typeof length !== 'number' || !Number.isFinite(length) || length < 0) return result(false, 'Length unknown or invalid');
      if (length >= p.exclusiveMeters) return result(false, 'Item is too long');
    }
    return result(true, '');
  }
};
export const burdenBudget: AdmissionBehavior<{ capacity: number }> = {
  ...metadata, id: 'burden-budget', evaluate: (ctx, p) => result(ctx.burden() <= p.capacity, 'Burden capacity exceeded')
};
export function admit(ctx: AdmissionContext, ref: BehaviorReference): PredicateResult {
  if (ref.version !== 1) throw new Error('Unknown admission behavior version');
  const p = ref.parameters;
  switch (ref.id) {
    case entityCount.id: return entityCount.evaluate(ctx, { maximum: number(p.maximum) });
    case itemTags.id: return itemTags.evaluate(ctx, { require: strings(p.require), reject: strings(p.reject) });
    case maximumLength.id: return maximumLength.evaluate(ctx, { exclusiveMeters: number(p.exclusiveMeters) });
    case burdenBudget.id: return burdenBudget.evaluate(ctx, { capacity: number(p.capacity) });
    case sizeBudget.id: {
      if (!p.costs || typeof p.costs !== 'object' || Array.isArray(p.costs)) throw new Error('Invalid size costs');
      const costs = Object.fromEntries(Object.entries(p.costs).map(([k, v]) => [k, number(v)]));
      return sizeBudget.evaluate(ctx, { capacity: number(p.capacity), costs });
    }
    default: throw new Error(`Unknown admission behavior: ${ref.id}`);
  }
}
