import template from './fixtures/personality.json' with { type: 'json' };
import { combatFixture } from './combat-scenario.ts';
import type { PersonalityDefinition } from '../core/game/personality.ts';
export const flamebringerTemplate = JSON.parse(JSON.stringify(template)) as PersonalityDefinition;
export function personalityFixture() {
  const data = combatFixture();
  const definition = data.definitions.find(d => d.id === 'definition:sword')!;
  definition.name = 'Flamebringer';
  definition.components.personalityProvider = { definitionId: template.id, version: template.version };
  data.entities.push({ id: 'item:second-flamebringer', definitionId: 'definition:sword', components: { ownership: { ownerId: 'character:alice' } } });
  data.entities.find(e => e.id === 'creature:target')!.components.traits = { tags: ['icy', 'susceptible-to-fire'] };
  return data;
}
