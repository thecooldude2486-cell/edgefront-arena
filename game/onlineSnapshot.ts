import { WEAPON_DEFINITIONS, type WeaponId } from './weaponDefinitions.ts';
import type { PlayerPose } from './onlineMovement';
export type OnlineInventory = Record<
  WeaponId,
  { ammo: number; reserve: number; cooldownMs: number }
>;
export const ONLINE_SLOTS: readonly (readonly WeaponId[])[] = [
  ['assaultRifle', 'sniper', 'rocketLauncher', 'laserCannon'],
  ['pistol', 'uzi'],
  ['sword', 'orbiter'],
  ['grenade', 'molotov'],
];
export function readOnlineLoadout(value: unknown): WeaponId[] | null {
  return Array.isArray(value) &&
    value.length === 4 &&
    value.every((id, index) => ONLINE_SLOTS[index].includes(id))
    ? [...value]
    : null;
}
export type OnlineCombatSnapshot = {
  loadout?: WeaponId[];
  health: number;
  weapon: WeaponId;
  pose: PlayerPose | null;
  ready: boolean;
  sequence: number;
  inventory: OnlineInventory;
};
export function readCombatSnapshot(
  value: unknown,
): OnlineCombatSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as OnlineCombatSnapshot;
  if (
    !Number.isInteger(data.health) ||
    data.health < 0 ||
    data.health > 100 ||
    !Object.hasOwn(WEAPON_DEFINITIONS, data.weapon) ||
    !Number.isSafeInteger(data.sequence) ||
    data.sequence < -1 ||
    typeof data.ready !== 'boolean'
  )
    return null;
  if (
    data.pose &&
    !['x', 'y', 'z', 'yaw', 'pitch'].every((key) =>
      Number.isFinite(data.pose![key as keyof PlayerPose]),
    )
  )
    return null;
  if (data.loadout && !readOnlineLoadout(data.loadout)) return null;
  if (!data.inventory) return null;
  for (const [id, stats] of Object.entries(WEAPON_DEFINITIONS)) {
    const supply = data.inventory[id as WeaponId];
    if (
      !supply ||
      !Number.isFinite(supply.ammo) ||
      (id !== 'laserCannon' && !Number.isInteger(supply.ammo)) ||
      supply.ammo < 0 ||
      supply.ammo > stats.magazineSize ||
      !Number.isInteger(supply.reserve) ||
      supply.reserve < 0 ||
      supply.reserve > stats.reserveAmmo ||
      !Number.isFinite(supply.cooldownMs) ||
      supply.cooldownMs < 0 ||
      supply.cooldownMs > stats.fireDelayMs
    )
      return null;
  }
  return data;
}
