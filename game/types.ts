import type { WeaponId } from './weaponDefinitions';

export type GameHudState = {
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
};

export type GameHudUpdate = Partial<GameHudState>;
