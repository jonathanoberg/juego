import type { BehaviorReference, EntityId, JsonValue, WorldTime } from './index.ts';
export interface PersonalityDefinition {
  id: string; version: number; name: string; narrative: string;
  initialDisposition: Record<string, number>;
  preferences: { subject: { tag?: string; entityId?: EntityId }; attitude: 'friendly' | 'hostile' }[];
  catchphrases: string[]; behaviors: BehaviorReference[];
}
export interface Relationship {
  subjectId: EntityId; affinity: number; resentment: number;
  lastSharedActivityAt: WorldTime; lastResentmentEvaluatedAt: WorldTime;
}
export interface PersonalityState {
  definitionId: string; definitionVersion: number; disposition: Record<string, number>;
  relationships: Relationship[]; memoryIds: string[]; processedEventIds: string[];
  lastSpokeAt?: WorldTime; catchphraseIndex: number;
}
export interface WorldEvent {
  id: string; type: string; at: WorldTime; actorId: EntityId; weaponId?: EntityId; targetId?: EntityId;
  facts: Record<string, JsonValue>;
}
export interface Memory {
  id: string; entityId: EntityId; at: WorldTime; eventId: string; subjectIds: EntityId[]; summary: string;
}
export interface ConversationMessage { id: string; at: WorldTime; speakerId: EntityId; text: string; }
export interface Conversation {
  id: string; participants: EntityId[]; messages: ConversationMessage[];
  summary?: { text: string; throughMessageId: string };
}
export interface DialogueContext {
  identity: { name: string; narrative: string; catchphrases: string[] };
  disposition: Record<string, number>; relationship: Relationship;
  preferences: PersonalityDefinition['preferences']; memories: Memory[];
  recentMessages: ConversationMessage[]; earlierSummary?: string;
  observations: { entityId: EntityId; description: string }[];
}
export interface DialogueAdapter { respond(context: Readonly<DialogueContext>): Promise<string>; }
