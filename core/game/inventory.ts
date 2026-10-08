import type { BehaviorMetadata, BehaviorReference, EntityId, PredicateResult } from './index.ts';
export interface PhysicalComponent {
  sizeClass?: string;
  weightClass?: string;
  dimensions?: { lengthMeters?: number };
  massKilograms?: number; // Optional detail; prototype burden rules use class points.
  tags: string[];
}
export interface ContainerComponent {
  compartments: { id: string; rules: BehaviorReference[] }[];
}
export type Placement =
  | { kind: 'carried'; actorId: EntityId }
  | { kind: 'equipped'; actorId: EntityId; slot: string }
  | { kind: 'contained'; containerId: EntityId; compartmentId: string }
  | { kind: 'world'; placeId: string };
export interface AdmissionItem { id: EntityId; physical?: PhysicalComponent; }
export interface AdmissionContext {
  containerId: EntityId;
  compartmentId: string;
  items: readonly AdmissionItem[]; // Proposed direct contents.
  burden: () => number; // Includes every nested item and its own weight.
}
export interface AdmissionBehavior<P> extends BehaviorMetadata {
  role: 'predicate';
  evaluate(context: AdmissionContext, parameters: Readonly<P>): PredicateResult;
}
