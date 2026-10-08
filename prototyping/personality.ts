import type { Entity, Definition, JsonValue } from '../core/game/index.ts';
import type { PersonalityDefinition, PersonalityState, Relationship, WorldEvent, Memory, Conversation, DialogueAdapter, DialogueContext } from '../core/game/personality.ts';
import { reactToPreferredTarget, inactivityResentment } from './personality-behaviors.ts';
// Fixed prototype limits; policy is deliberately outside the generic core interfaces.
export class PrototypePersonalities {
  private states = new Map<string, PersonalityState>();
  private templates: PersonalityDefinition[];
  private memories: Memory[] = [];
  private conversations: Conversation[] = [];
  private busy = new Set<string>();
  constructor(entities: Entity[], templates: PersonalityDefinition[], definitions: Definition[] = [], records: { memories: Memory[]; conversations: Conversation[] } = { memories: [], conversations: [] }) {
    this.memories = structuredClone(records.memories); this.conversations = structuredClone(records.conversations);
    this.templates = structuredClone(templates);
    for (const entity of entities) {
      const provider = (entity.components.personalityProvider ?? definitions.find(d => d.id === entity.definitionId)?.components.personalityProvider) as { definitionId?: string; version?: number } | undefined;
      if (!provider) continue;
      const template = this.templates.find(t => t.id === provider.definitionId && t.version === provider.version);
      if (!template) throw new Error('Unknown personality template');
      const saved = entity.components.personality as unknown as PersonalityState | undefined;
      this.states.set(entity.id, structuredClone(saved ?? {
        definitionId: template.id, definitionVersion: template.version,
        disposition: template.initialDisposition, relationships: [], memoryIds: [], processedEventIds: [], catchphraseIndex: 0
      }));
    }
  }
  private state(id: string) { const s = this.states.get(id); if (!s) throw new Error('Entity has no personality'); return s; }
  private template(id: string) { const s = this.state(id); const t = this.templates.find(t => t.id === s.definitionId && t.version === s.definitionVersion); if (!t) throw new Error('Unknown personality version'); return t; }
  records() { return structuredClone({ memories: this.memories, conversations: this.conversations }); }
  snapshot(id: string) { return structuredClone(this.state(id)); }
  entityWithState(entity: Entity): Entity { return { ...structuredClone(entity), components: { ...structuredClone(entity.components), personality: this.snapshot(entity.id) as unknown as JsonValue } }; }
  private relationship(state: PersonalityState, subjectId: string, at: number): Relationship {
    let r = state.relationships.find(r => r.subjectId === subjectId);
    if (!r) { r = { subjectId, affinity: 0, resentment: 0, lastSharedActivityAt: at, lastResentmentEvaluatedAt: at }; state.relationships.push(r); }
    return r;
  }
  process(events: readonly WorldEvent[]) {
    for (const event of events) {
      if (!event.weaponId || !this.states.has(event.weaponId) || event.type !== 'attack-resolved') continue;
      const state = this.state(event.weaponId);
      if (state.processedEventIds.includes(event.id)) continue;
      const rule = this.template(event.weaponId).behaviors.find(b => b.id === 'react-to-preferred-target');
      if (!rule || rule.version !== 1) throw new Error('Unknown personality event behavior');
      const tag = rule.parameters.tag, gain = rule.parameters.affinityGain;
      if (typeof tag !== 'string' || typeof gain !== 'number' || !Number.isFinite(gain)) throw new Error('Invalid personality rule');
      const relationship = this.relationship(state, event.actorId, event.at);
      const reaction = reactToPreferredTarget.evaluate(event, relationship, { tag, affinityGain: gain });
      Object.assign(relationship, reaction.relationship);
      if (reaction.remember) {
        const id = `memory:${event.weaponId}:${event.id}`;
        this.memories.push({ id, entityId: event.weaponId, at: event.at, eventId: event.id,
          subjectIds: [event.actorId, ...(event.targetId ? [event.targetId] : [])],
          summary: `${event.actorId} attacked ${event.targetId} with me; target was ${tag}; ${event.facts.hit ? 'hit' : 'miss'}.` });
        state.memoryIds.push(id);
      }
      state.processedEventIds.push(event.id);
    }
  }
  evaluateInactivity(id: string, subjectId: string, now: number) {
    if (!Number.isFinite(now) || now < 0) throw new Error('Invalid simulation time');
    const state = this.state(id), relationship = this.relationship(state, subjectId, now);
    if (now < relationship.lastResentmentEvaluatedAt) throw new Error('Time cannot move backwards');
    const rule = this.template(id).behaviors.find(b => b.id === 'inactivity-resentment');
    if (!rule || rule.version !== 1) throw new Error('Unknown inactivity behavior');
    const interval = rule.parameters.intervalSeconds, gain = rule.parameters.gain;
    if (typeof interval !== 'number' || !Number.isFinite(interval) || interval <= 0 || typeof gain !== 'number' || !Number.isFinite(gain) || gain < 0) throw new Error('Invalid inactivity rule');
    Object.assign(relationship, inactivityResentment.evaluate(relationship, now, { intervalSeconds: interval, gain }));
  }
  blurt(id: string, now: number): string | undefined {
    const state = this.state(id), template = this.template(id);
    if (!Number.isFinite(now) || now < (state.lastSpokeAt ?? 0)) throw new Error('Invalid speech time');
    if (state.lastSpokeAt !== undefined && now - state.lastSpokeAt < 30) return undefined;
    if (!template.catchphrases.length) return undefined;
    const phrase = template.catchphrases[state.catchphraseIndex % template.catchphrases.length];
    state.catchphraseIndex += 1; state.lastSpokeAt = now; return phrase;
  }
  history(id: string, listenerId: string): Conversation | undefined {
    return structuredClone(this.conversations.find(c => c.participants[0] === id && c.participants[1] === listenerId));
  }
  private context(id: string, listenerId: string, now: number, conversation: Conversation, observations: DialogueContext['observations']): DialogueContext {
    const state = this.snapshot(id), template = this.template(id);
    // Context construction does not mutate affinity or resentment.
    const relationship = this.relationship(state, listenerId, now);
    return structuredClone({ identity: { name: template.name, narrative: template.narrative, catchphrases: template.catchphrases },
      disposition: state.disposition, relationship, preferences: template.preferences,
      memories: this.memories.filter(m => m.entityId === id && m.subjectIds.includes(listenerId)).slice(-5),
      recentMessages: conversation.messages.slice(-8), earlierSummary: conversation.messages.length > 8 ? conversation.messages.slice(0, -8).map(m => `${m.speakerId}: ${m.text}`).join('\n') : conversation.summary?.text, observations });
  }
  async talk(id: string, listenerId: string, text: string, now: number, observations: DialogueContext['observations'], adapter: DialogueAdapter) {
    if (this.busy.has(id)) throw new Error('Personality is already responding');
    if (!text.trim() || !Number.isFinite(now) || now < 0) throw new Error('Invalid conversation input');
    if (now < (this.state(id).lastSpokeAt ?? 0)) throw new Error('Speech time cannot move backwards');
    this.busy.add(id);
    try {
      const conversation = this.history(id, listenerId) ?? { id: `conversation:${id}:${listenerId}`, participants: [id, listenerId], messages: [] };
      if (now < (conversation.messages.at(-1)?.at ?? 0)) throw new Error('Conversation time cannot move backwards');
      const next = conversation.messages.length + 1;
      conversation.messages.push({ id: `${conversation.id}:${next}`, at: now, speakerId: listenerId, text });
      const reply = await adapter.respond(this.context(id, listenerId, now, conversation, observations));
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('Empty dialogue response');
      conversation.messages.push({ id: `${conversation.id}:${next + 1}`, at: now, speakerId: id, text: reply });
      // Preserve exact old messages in a deterministic summary; this is not an LLM summarizer.
      if (conversation.messages.length > 8) {
        const older = conversation.messages.slice(0, -8);
        conversation.summary = { text: older.map(m => `${m.speakerId}: ${m.text}`).join('\n'), throughMessageId: older.at(-1)!.id };
      }
      this.conversations = this.conversations.filter(c => c.id !== conversation.id); this.conversations.push(conversation);
      const state = this.state(id); this.relationship(state, listenerId, now); state.lastSpokeAt = now;
      return reply;
    } finally { this.busy.delete(id); }
  }
}
