import type { Definition, Entity, JsonValue } from '../core/game/index.ts';
import type { ObjectiveDefinition, ObjectiveInstance } from '../core/game/quests.ts';
import { PrototypeInventory } from './inventory.ts';
export interface QuestEvent { id: string; type: string; actorId: string; at: number; facts: Record<string, JsonValue>; }
export function goalSignature(objective: ObjectiveDefinition): string {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, stable(value)])) : value;
  return JSON.stringify(stable(objective.behavior));
}
export function evaluateObjective(definition: ObjectiveDefinition, instance: ObjectiveInstance, participantId: string, entities: Entity[], definitions: Definition[], events: QuestEvent[]) {
  const ref = definition.behavior, p = ref.parameters;
  if (ref.version !== 1) throw new Error('Unknown objective behavior version');
  if (ref.id === 'count-carried-items') {
    if (typeof p.itemDefinitionId !== 'string' || !Number.isSafeInteger(p.minimum) || (p.minimum as number) < 1) throw new Error('Invalid item objective');
    const carried = new Set(new PrototypeInventory(entities, definitions).carried(participantId).map(e => e.id));
    const matches = entities.filter(e => carried.has(e.id) && e.definitionId === p.itemDefinitionId);
    return { satisfied: matches.length >= (p.minimum as number), evidenceIds: matches.map(e => e.id) };
  }
  if (ref.id === 'visit-location') {
    if (typeof p.locationId !== 'string') throw new Error('Invalid visit objective');
    const matches = events.slice(instance.eventOffset).filter(e => e.actorId === participantId && e.type === 'location-visited' && e.facts.locationId === p.locationId);
    return { satisfied: matches.length > 0, evidenceIds: matches.map(e => e.id) };
  }
  if (ref.id === 'deliver-items') {
    if (typeof p.itemDefinitionId !== 'string' || typeof p.recipientId !== 'string' || !Number.isSafeInteger(p.minimum) || (p.minimum as number) < 1) throw new Error('Invalid delivery objective');
    const matches = events.slice(instance.eventOffset).filter(e => e.actorId === participantId && e.type === 'items-delivered' && e.facts.itemDefinitionId === p.itemDefinitionId && e.facts.recipientId === p.recipientId);
    return { satisfied: matches.reduce((sum, e) => sum + (typeof e.facts.count === 'number' ? e.facts.count : 0), 0) >= (p.minimum as number), evidenceIds: matches.map(e => e.id) };
  }
  if (ref.id === 'count-events') {
    if (typeof p.type !== 'string' || !Number.isSafeInteger(p.minimum) || (p.minimum as number) < 1) throw new Error('Invalid event objective');
    const matches = events.slice(instance.eventOffset).filter(e => e.actorId === participantId && e.type === p.type && (p.actorDefinitionId === undefined || e.facts.actorDefinitionId === p.actorDefinitionId));
    return { satisfied: matches.length >= (p.minimum as number), evidenceIds: matches.map(e => e.id) };
  }
  throw new Error(`Unknown objective behavior: ${ref.id}`);
}
