import type { WeaponId } from './weaponDefinitions';
import {
  SNIPER_PRICE,
  ROCKET_PRICE,
  UZI_PRICE,
  MOLOTOV_PRICE,
  ORBITER_CLICKS,
} from './createOrbWallet';

export const WEAPON_SLOTS: { name: string; weapons: WeaponId[] }[] = [
  {
    name: 'Primary',
    weapons: ['assaultRifle', 'sniper', 'rocketLauncher', 'laserCannon'],
  },
  { name: 'Secondary', weapons: ['pistol', 'uzi'] },
  { name: 'Melee', weapons: ['sword', 'orbiter'] },
  { name: 'Utility', weapons: ['grenade', 'molotov'] },
];
export type UnlockProgress = { laserPartsCount: number; orbClicks: number };
export function weaponSlot(id: WeaponId) {
  return WEAPON_SLOTS.findIndex((slot) => slot.weapons.includes(id));
}
export function weaponUnlockRequirement(
  id: WeaponId,
  progress: UnlockProgress = { laserPartsCount: 0, orbClicks: 0 },
) {
  switch (id) {
    case 'sniper':
      return `Unlock in Armory · ${SNIPER_PRICE} Orbs`;
    case 'rocketLauncher':
      return `Unlock in Armory · ${ROCKET_PRICE} Orbs`;
    case 'uzi':
      return `Unlock in Armory · ${UZI_PRICE} Orbs`;
    case 'molotov':
      return `Unlock in Armory · ${MOLOTOV_PRICE} Orbs`;
    case 'laserCannon':
      return `Find lobby parts · ${progress.laserPartsCount}/5`;
    case 'orbiter':
      return `Click Armory Orb badge · ${progress.orbClicks}/${ORBITER_CLICKS}`;
    default:
      return 'Available in Armory';
  }
}
