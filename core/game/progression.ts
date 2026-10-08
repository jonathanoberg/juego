import type { BehaviorReference, WorldTime } from './index.ts';

// These are typed components of ordinary definitions/entities, not new identity systems.
export interface SpellDefinitionComponent { description: string; }
export interface ClassSpellOption {
  spellDefinitionId: string;
  minimumClassLevel: number;
  prerequisiteSpellIds: string[];
}
export interface ClassDefinitionComponent {
  maximumLevel: number;
  spellOptions: ClassSpellOption[];
  equipmentRules: BehaviorReference[];
}
export interface SpellSelection {
  spellDefinitionId: string;
  learnedAtClassLevel: number;
  learnedAt: WorldTime;
  masteryRank: number; // Separate from character class level; advancement rules remain open.
}
export interface ClassProgress {
  classDefinitionId: string;
  level: number;
  achievedLevels: { level: number; achievedAt: WorldTime }[];
  spellSelections: SpellSelection[];
}
export interface ProgressionComponent { classes: ClassProgress[]; }
export interface ArmorComponent { category: string; reduceHit: number; reduceDamage: number; }
export interface EquippableComponent { slots: string[]; }
export interface SpellAvailability {
  spellDefinitionId: string;
  learned: boolean;
  learnable: boolean;
  reasons: string[];
}
