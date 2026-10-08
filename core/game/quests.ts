import type { BehaviorReference, EntityId, WorldTime } from './index.ts';
export interface ObjectiveDefinition { id: string; version: number; description: string; behavior: BehaviorReference; }
export interface ObjectiveBinding {
  id: string; objectiveDefinitionId: string; objectiveVersion: number;
  priorCompletion: 'allow' | 'fresh'; completionMode: 'latch' | 'recheck';
}
export type ObjectiveRequirement = { objective: string } | { all: ObjectiveRequirement[] } | { any: ObjectiveRequirement[] };
export interface QuestStage {
  id: string; narrative: string; objectives: ObjectiveBinding[]; requirement: ObjectiveRequirement;
  next: string[];
  effectsOnEntry?: { definitionId: string; lifetime: 'stage' | 'quest' }[];
}
export type QuestReward =
  | { id: string; kind: 'base-attribute'; attribute: string; amount: number }
  | { id: string; kind: 'spell'; classDefinitionId: string; spellDefinitionId: string; bypassEligibility: boolean }
  | { id: string; kind: 'item'; definitionId: string; placementPolicy: 'carried' | 'world-at-participant' };
export interface QuestDefinition {
  id: string; version: number; narrative: string; acceptancePredicates: BehaviorReference[];
  initialStages: string[]; stages: QuestStage[]; rewards: QuestReward[];
}
export interface ObjectiveInstance {
  id: string; bindingId: string; stageId: string; definitionId: string; version: number;
  activatedAt: WorldTime; eventOffset: number; satisfied: boolean; completed: boolean; evidenceIds: string[];
}
export interface QuestInstance {
  id: string; definitionId: string; definitionVersion: number; participantId: EntityId; giverId: EntityId;
  status: 'active' | 'completed' | 'abandoned' | 'failed'; activeStages: string[]; completedStages: string[];
  objectives: ObjectiveInstance[]; rewardReceiptIds: string[];
}
export interface ObjectiveCompletionRecord {
  id: string; participantId: EntityId; objectiveDefinitionId: string; objectiveVersion: number;
  goalSignature: string; completedAt: WorldTime; evidenceIds: string[];
}
export interface RewardReceipt { id: string; questInstanceId: string; rewardId: string; grantedAt: WorldTime; }
