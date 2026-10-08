import type { Components, EntityId } from './index.ts';
export interface ActorComponent { controller: 'player' | 'npc'; }
export interface CreatureComponent { speciesId: string; lifeStage: string; }
export interface GroupComponent { purpose: string; objectives: string[]; }
export interface RoleDefinitionComponent { capabilityIds: string[]; membershipRole: string; }
export interface GroupMembership { groupId: EntityId; memberId: EntityId; roles: string[]; }
export interface SpawnRecipe {
  id: string; groupDefinitionId: string;
  members: { definitionId: string; count: { minimum: number; maximum: number } }[];
  roleAssignments: {
    roleDefinitionId: string;
    eligible: { speciesId?: string; lifeStage?: string };
    probabilityPerCandidate: number; maximumCount: number;
  }[];
}
export interface ActorRoleComponent { definitionIds: string[]; }
export interface CapabilityComponent { ids: string[]; }
// Actor and group definitions remain ordinary definitions with typed components.
export interface SpawnOverrides { name?: string; components?: Components; }
