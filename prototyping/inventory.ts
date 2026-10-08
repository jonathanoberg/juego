import type { Definition, Entity, JsonValue } from '../core/game/index.ts';
import type { ContainerComponent, PhysicalComponent, Placement } from '../core/game/inventory.ts';
import { admit } from './container-rules.ts';
// Sample gameplay units, not kilograms. The vocabulary is content-configurable.
export const defaultBurdenPoints: Record<string, number> = { featherweight: 1, bookweight: 3, anvilweight: 30 };
export class PrototypeInventory {
  private entities: Entity[];
  private definitions: Definition[];
  private weights: Record<string, number>;
  constructor(entities: Entity[], definitions: Definition[], weights = defaultBurdenPoints) {
    this.definitions = definitions; this.weights = weights;
    this.entities = structuredClone(entities);
    // Migrate legacy ownership/equipment fixtures into explicit physical placement.
    for (const entity of this.entities) {
      if (entity.components.placement) continue;
      const wearer = this.entities.find(e => Object.values((e.components.equipment ?? {}) as Record<string, JsonValue>).includes(entity.id));
      if (wearer) {
        const slot = Object.entries(wearer.components.equipment as Record<string, JsonValue>).find(([, id]) => id === entity.id)![0];
        entity.components.placement = { kind: 'equipped', actorId: wearer.id, slot };
      } else {
        const owner = (entity.components.ownership as Record<string, JsonValue> | undefined)?.ownerId;
        if (typeof owner === 'string') entity.components.placement = { kind: 'carried', actorId: owner };
      }
    }
  }
  snapshot(): Entity[] { return structuredClone(this.entities); }
  private entity(id: string) { const e = this.entities.find(e => e.id === id); if (!e) throw new Error(`Unknown entity: ${id}`); return e; }
  private component<T>(id: string, key: string): T | undefined {
    const e = this.entity(id);
    return (e.components[key] ?? this.definitions.find(d => d.id === e.definitionId)?.components[key]) as unknown as T | undefined;
  }
  placement(id: string): Placement | undefined { return structuredClone(this.component<Placement>(id, 'placement')); }
  directContents(containerId: string, compartmentId?: string): Entity[] {
    this.entity(containerId);
    return structuredClone(this.entities.filter(e => {
      const p = e.components.placement as unknown as Placement | undefined;
      return p?.kind === 'contained' && p.containerId === containerId && (compartmentId === undefined || p.compartmentId === compartmentId);
    }));
  }
  carried(actorId: string): { id: string; placement: Placement }[] {
    this.entity(actorId);
    return this.entities.filter(e => {
      let p = this.placement(e.id);
      const seen = new Set([e.id]);
      while (p?.kind === 'contained') {
        if (seen.has(p.containerId)) throw new Error('Containment cycle');
        seen.add(p.containerId); p = this.placement(p.containerId);
      }
      return (p?.kind === 'carried' || p?.kind === 'equipped') && p.actorId === actorId;
    }).map(e => ({ id: e.id, placement: this.placement(e.id)! }));
  }
  private burden(id: string, seen = new Set<string>()): number {
    if (seen.has(id)) throw new Error('Containment cycle');
    const path = new Set(seen); path.add(id);
    const category = this.component<PhysicalComponent>(id, 'physical')?.weightClass;
    const weight = category === undefined ? undefined : this.weights[category];
    if (weight === undefined || !Number.isFinite(weight) || weight < 0) throw new Error(`Weight class unknown: ${id}`);
    return weight + this.directContents(id).reduce((sum, e) => sum + this.burden(e.id, path), 0);
  }
  private validate() {
    for (const e of this.entities) {
      const p = this.placement(e.id);
      const seen = new Set([e.id]);
      let cursor = p;
      while (cursor?.kind === 'contained') {
        if (seen.has(cursor.containerId)) throw new Error('Containment cycle');
        seen.add(cursor.containerId);
        const compartmentId = cursor.compartmentId;
        const container = this.component<ContainerComponent>(cursor.containerId, 'container');
        if (!container?.compartments.some(c => c.id === compartmentId)) throw new Error('Unknown compartment');
        cursor = this.placement(cursor.containerId);
      }
    }
    // Revalidate containers against staged contents, including ancestors of nested moves.
    for (const e of this.entities) {
      for (const compartment of this.component<ContainerComponent>(e.id, 'container')?.compartments ?? []) {
        const contents = this.directContents(e.id, compartment.id);
        for (const rule of compartment.rules) {
          const result = admit({ containerId: e.id, compartmentId: compartment.id,
            items: contents.map(i => ({ id: i.id, physical: this.component<PhysicalComponent>(i.id, 'physical') })),
            burden: () => contents.reduce((sum, i) => sum + this.burden(i.id), 0) }, rule);
          if (!result.satisfied) throw new Error(`${e.id}/${compartment.id}: ${result.reason}`);
        }
      }
    }
  }
  move(actorId: string, itemId: string, destination: Placement): Entity[] {
    const item = this.entity(itemId); this.entity(actorId);
    if ((item.components.ownership as Record<string, JsonValue> | undefined)?.ownerId !== actorId) throw new Error('Item is not owned by actor');
    if (destination.kind === 'contained') {
      const container = this.entity(destination.containerId);
      if ((container.components.ownership as Record<string, JsonValue> | undefined)?.ownerId !== actorId) throw new Error('Container is not owned by actor');
    } else if ((destination.kind === 'carried' || destination.kind === 'equipped') && destination.actorId !== actorId) throw new Error('Cannot place item on another actor');
    item.components.placement = destination as unknown as JsonValue;
    this.validate();
    // Equipment is a compatibility projection of the single placement relation.
    for (const e of this.entities) if (e.components.equipment) e.components.equipment = {};
    for (const e of this.entities) {
      const p = this.placement(e.id);
      if (p?.kind !== 'equipped') continue;
      const actor = this.entity(p.actorId);
      const equipment = (actor.components.equipment ?? {}) as Record<string, JsonValue>;
      if (equipment[p.slot]) throw new Error('Equipment slot occupied');
      actor.components.equipment = { ...equipment, [p.slot]: e.id };
    }
    return this.snapshot();
  }
}
