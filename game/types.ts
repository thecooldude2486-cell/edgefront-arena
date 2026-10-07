import type { WeaponId } from './weaponDefinitions';

export type GameHudState = {
  teamIntermission?: boolean;
  teamAlive?: boolean[];
  teamSize?: number;
  deathRecap: import('./deathRecap').DeathRecap | null;
  nearbyLaserPart: string | null;
  laserPartsCount: number;
  laserUnlocked: boolean;
  laserProgressSaved: boolean;
  laserNotice: string;
  lobbyStation: import('./lobbyStations').LobbyStationId | null;
  swordBoostState: string;
  swordBoostSeconds: number;
  grappleState: import('./createGrapple').GrappleState;
  scoped: boolean;
  weaponId: WeaponId;
  weaponName: string;
  fireMode: string;
  ammo: number;
  reserveAmmo: number;
  reloading: boolean;
  hitMarker: 'none' | 'body' | 'head' | 'direct';
  hitId: number;
  health: number;
  maxHealth: number;
  botHealth: number;
  dead: boolean;
  roundWon: boolean;
  damageId: number;
  playerScore: number;
  botScore: number;
  result: 'none' | 'victory' | 'defeat';
  paused: boolean;
  awaitingFirstInput: boolean;
};

export type GameHudUpdate = Partial<GameHudState> & {
  elimination?: import('./combatXp').EliminationPerformance;
};
