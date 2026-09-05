import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { WEAPON_DEFINITIONS } from './weaponDefinitions';

// Player health regeneration settings. Change these three values to tune it.
export const MAX_HEALTH = 100;
export const REGEN_DELAY = 5;
export const REGEN_RATE = 20;

// The values here are the easiest place to tune the feel of the game.
export const PLAYER = {
  maxHealth: MAX_HEALTH,
  lookSensitivity: 1350,
  lookInertia: 0.1,
  walkSpeed: 5.4,
  crouchSpeed: 2.7,
  sprintSpeed: 8.6,
  groundAcceleration: 16,
  airAcceleration: 5,
  gravity: -23,
  jumpSpeed: 8.4,
  eyeHeight: 1.72,
  crouchEyeHeight: 1.12,
  colliderHalfHeight: 0.9,
};

export const WEAPON = WEAPON_DEFINITIONS.assaultRifle;
export const PISTOL = WEAPON_DEFINITIONS.pistol;

export const BOT = {
  maxHealth: 100,
  respawnMs: 2000,
};

export const MATCH = {
  scoreToWin: 5,
};

export const SPAWNS = {
  player: new Vector3(0, PLAYER.eyeHeight, -17),
  playerYaw: 0,
  bot: new Vector3(0, 1, 17),
  botYaw: Math.PI,
};

export const COLORS = {
  navy: '#071926',
  floor: '#163344',
  floorLight: '#21485a',
  cyan: '#35d5ea',
  coral: '#ff6f6a',
  lime: '#b9f465',
  white: '#dcebf0',
};
