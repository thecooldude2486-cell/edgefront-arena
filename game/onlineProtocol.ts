import type { Cosmetics } from './progression';
import type { CharacterAppearance } from './storeCatalog';
import type { EliminationPerformance } from './combatXp';
import type { OnlineEffect } from './onlineEffects';
import type { PlayerPose, GrenadeThrow } from './onlineMovement';
import type { WeaponId } from './weaponDefinitions';
export type OnlineRoomState = {
  type: 'room';
  mapId?: import('./maps').ArenaMapId;
  code: string;
  player: number;
  players: boolean[];
  ready: boolean;
  visibility: 'public' | 'private';
  paused?: boolean;
  rematching?: boolean;
  reconnectUntil?: number;
  matchId?: number;
  rematchReady?: boolean[];
  names?: string[];
  profiles?: {
    level: number;
    cosmetics: Cosmetics;
    character?: CharacterAppearance;
  }[];
};
export type OnlineMatchState = {
  scores: number[];
  round: number;
  phase: 'playing' | 'roundOver' | 'finished';
  winner: number | null;
};
export type OnlineServerMessage =
  | {
      type: 'environment';
      state: unknown;
      running: boolean;
      round: number;
      matchId: number;
    }
  | OnlineRoomState
  | ({
      type: 'score';
      recaps?: unknown[];
      matchId: number;
      performances?: EliminationPerformance[];
    } & OnlineMatchState)
  | {
      type: 'sync';
      recaps?: unknown[];
      matchId: number;
      match: OnlineMatchState;
      players: unknown[];
      named: boolean[];
      loadoutReady: boolean[] | null;
      remainingMs: number | null;
      rematching: boolean;
    }
  | { type: 'session'; token: string; resumed?: boolean }
  | { type: 'resumeRejected'; message: string; retryable?: boolean }
  | { type: 'netProbe'; id: number }
  | { type: 'netStats'; rttMs: number }
  | {
      type: 'rematchStart' | 'loadoutCountdown';
      matchId?: number;
      remainingMs: number;
    }
  | { type: 'matchStart'; matchId: number }
  | { type: 'nameAccepted'; name: string }
  | {
      type: 'rooms';
      rooms: {
        code: string;
        players: number;
        mapId?: import('./maps').ArenaMapId;
      }[];
    }
  | { type: 'move'; player: number; pose: PlayerPose }
  | { type: 'hit'; kind: 'body' | 'head' | 'direct'; sequence: number }
  | { type: 'health'; players: { health: number; eliminated: boolean }[] }
  | ({ type: 'effect'; player: number } & OnlineEffect)
  | ({ type: 'grenade'; player: number } & GrenadeThrow)
  | { type: 'shot' | 'equip'; player: number; weapon: WeaponId }
  | { type: 'error'; message: string }
  | { type: 'closed' | 'left'; message?: string };
