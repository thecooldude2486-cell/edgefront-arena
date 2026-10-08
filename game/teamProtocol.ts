import type { ArenaMapId } from './maps';
import type { TeamSize } from './teams';
import type { PlayerPose } from './onlineMovement';
import type { WeaponId } from './weaponDefinitions';
import type { Cosmetics } from './progression';
import type { CharacterAppearance } from './storeCatalog';
import type { DeathRecap } from './deathRecap';
import type { EnvironmentState } from './arenaEnvironment';
export type TeamPlayer = {
  slot: number;
  name: string;
  connected: boolean;
  occupied?: boolean;
  ready: boolean;
  health: number;
  pose: PlayerPose | null;
  weapon: WeaponId;
  kills: number;
  deaths: number;
  profile: {
    level: number;
    cosmetics: Cosmetics;
    character?: CharacterAppearance;
  };
};
export type TeamRoomState = {
  type: 'teamState';
  code: string;
  slot: number;
  token: string;
  size: TeamSize;
  players: TeamPlayer[];
  mapId: ArenaMapId;
  votes: (ArenaMapId | null)[];
  phase:
    | 'waiting'
    | 'voting'
    | 'loadout'
    | 'countdown'
    | 'playing'
    | 'intermission'
    | 'finished';
  deadline: number | null;
  paused: boolean;
  scores: number[];
  round: number;
  winner: number | null;
  environment: EnvironmentState;
  recap: DeathRecap | null;
  performance: import('./combatXp').EliminationPerformance;
};
