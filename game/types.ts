import type { WeaponId } from './weaponDefinitions';

export type GameHudState = {
  weaponId: WeaponId;
  weaponName: string;
  fireMode: string;
  ammo: number;
  reserveAmmo: number;
  reloading: boolean;
  hitMarker: 'none' | 'body' | 'head';
  hitId: number;
  health: number;
  maxHealth: number;
  regenerating: boolean;
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
