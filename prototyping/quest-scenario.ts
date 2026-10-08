import extra from './fixtures/quests.json' with { type: 'json' };
import { inventoryFixture } from './inventory-scenario.ts';
import type { QuestFixture } from './quests.ts';
export function questFixture(): QuestFixture {
  const data = inventoryFixture();
  data.definitions.push(...JSON.parse(JSON.stringify(extra.definitions)));
  data.entities.push(...JSON.parse(JSON.stringify(extra.entities)));
  data.effectDefinitions.push(...JSON.parse(JSON.stringify(extra.effectDefinitions)));
  data.definitions.find(d => d.id === 'class:sword-wizard')!.components.classTags = ['mage'];
  const actor = data.entities.find(e => e.id === 'character:alice')!;
  const progress = actor.components.progression as unknown as { classes: { level: number; achievedLevels: { level: number; achievedAt: number }[] }[] };
  progress.classes[0].level = 10;
  progress.classes[0].achievedLevels = Array.from({ length: 10 }, (_, i) => ({ level: i + 1, achievedAt: 0 }));
  actor.components.equipment = { finger: 'item:ring-42' };
  // Explicit placement must agree with the fixture's equipment projection.
  data.entities.find(e => e.id === 'item:ring-42')!.components.placement = { kind: 'equipped', actorId: actor.id, slot: 'finger' };
  return { ...data, quests: JSON.parse(JSON.stringify(extra.quests)), objectiveDefinitions: JSON.parse(JSON.stringify(extra.objectiveDefinitions)) };
}
