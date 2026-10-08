import fixture from './fixtures/groups.json' with { type: 'json' };
import type { Definition } from '../core/game/index.ts';
import type { SpawnRecipe } from '../core/game/groups.ts';
import type { PersonalityDefinition } from '../core/game/personality.ts';
export function groupFixture() {
  return JSON.parse(JSON.stringify(fixture)) as { definitions: Definition[]; personalities: PersonalityDefinition[]; recipe: SpawnRecipe };
}
