import type { WeaponId } from './weaponDefinitions';
import type { OnlineEffect } from './onlineEffects';
export type PlayerPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
};
export type GrenadeThrow = {
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
};
export type OnlineGame = {
  spectatePlayer: (slot: number) => void;
  cycleSpectator: (direction: number) => void;
  setBotTeamSize: (size: import('./teams').TeamSize) => void;
  enterTeamOnline: (slot: number, size: number) => void;
  receiveTeamRoster: (
    players: import('./teamProtocol').TeamPlayer[],
    roundOver?: boolean,
  ) => void;
  receiveTeamEffect: (slot: number, data: OnlineEffect) => void;
  setOnlineEnvironment: (
    state: import('./arenaEnvironment').EnvironmentState,
    running: boolean,
  ) => void;
  setArenaMap: (id: import('./maps').ArenaMapId) => void;
  setOnlineNetworkPaused: (paused: boolean) => void;
  restoreOnlineCombat: (
    snapshot: import('./onlineSnapshot').OnlineCombatSnapshot,
  ) => void;
  setCharacterAppearance: (
    appearance: import('./storeCatalog').CharacterAppearance,
  ) => void;
  receiveOnlineCharacter: (
    appearance: import('./storeCatalog').CharacterAppearance,
  ) => void;
  setCosmetics: (cosmetics: import('./progression').Cosmetics) => void;
  receiveOnlineCosmetics: (
    cosmetics: import('./progression').Cosmetics,
  ) => void;
  setOnlineHealth: (health: number, opponentHealth: number) => void;
  prepareMatch: () => void;
  setPreMatchLocked: (locked: boolean) => void;
  setOnlineEffectListener: (
    listener: ((data: OnlineEffect) => void) | null,
  ) => void;
  receiveOnlineEffect: (data: OnlineEffect) => void;
  enterOnline: (player: number) => void;
  enterLobby: () => void;
  readOnlinePose: () => PlayerPose;
  receiveOnlinePose: (pose: PlayerPose) => void;
  requestPointerLock: () => void;
  readOnlineWeapon: () => WeaponId;
  receiveOnlineWeapon: (id: WeaponId) => void;
  receiveOnlineShot: (id: WeaponId) => void;
  receiveOnlineGrenade: (throwData: GrenadeThrow) => void;
  setOnlineGrenadeListener: (
    listener: ((throwData: GrenadeThrow) => void) | null,
  ) => void;
  setOnlineShotListener: (listener: ((id: WeaponId) => void) | null) => void;
  onlineLoadout: () => WeaponId[];
  selectWeapon: (id: WeaponId) => void;
};
export const MOVEMENT_SEND_MS = 50; // 20 updates per second, independent of rendering.
export function smoothPose(
  current: PlayerPose,
  target: PlayerPose,
  seconds: number,
): PlayerPose {
  const blend = 1 - Math.exp(-14 * Math.max(0, seconds));
  const angle = Math.atan2(
    Math.sin(target.yaw - current.yaw),
    Math.cos(target.yaw - current.yaw),
  );
  return {
    x: current.x + (target.x - current.x) * blend,
    y: current.y + (target.y - current.y) * blend,
    z: current.z + (target.z - current.z) * blend,
    yaw: current.yaw + angle * blend,
    pitch: current.pitch + (target.pitch - current.pitch) * blend,
  };
}
