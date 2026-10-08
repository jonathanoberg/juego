import type { Relationship, WorldEvent } from '../core/game/personality.ts';
const clamp = (n: number) => Math.max(0, Math.min(100, n));
export const reactToPreferredTarget = {
  id: 'react-to-preferred-target', version: 1,
  evaluate(event: Readonly<WorldEvent>, relationship: Readonly<Relationship>, parameters: { tag: string; affinityGain: number }) {
    if (!Number.isFinite(event.at) || event.at < relationship.lastSharedActivityAt) throw new Error('Out-of-order personality event');
    const next: Relationship = { ...relationship };
    next.lastSharedActivityAt = event.at; next.lastResentmentEvaluatedAt = event.at;
    const tags = event.facts.targetTags;
    const remember = Array.isArray(tags) && tags.includes(parameters.tag);
    if (remember) {
      next.affinity = clamp(next.affinity + parameters.affinityGain);
      next.resentment = clamp(next.resentment - 2);
    }
    return { relationship: next, remember };
  }
};
export const inactivityResentment = {
  id: 'inactivity-resentment', version: 1,
  evaluate(relationship: Readonly<Relationship>, now: number, parameters: { intervalSeconds: number; gain: number }) {
    if (now < relationship.lastResentmentEvaluatedAt) throw new Error('Time cannot move backwards');
    const next: Relationship = { ...relationship };
    const periods = Math.floor((now - next.lastResentmentEvaluatedAt) / parameters.intervalSeconds);
    next.resentment = clamp(next.resentment + periods * parameters.gain);
    next.lastResentmentEvaluatedAt += periods * parameters.intervalSeconds;
    return next;
  }
};
