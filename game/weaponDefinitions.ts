export const WEAPON_DEFINITIONS = {
  uzi: {
    rarity: 'uncommon',
    name: 'Flux Uzi',
    magazineSize: 24,
    reserveAmmo: 96,
    bodyDamage: 9,
    headDamage: 12,
    reloadMs: 1800,
    fireDelayMs: 80,
    fireMode: 'Auto',
    range: 90,
  },
  laserCannon: {
    rarity: 'legendary',
    name: 'Helion',
    magazineSize: 100,
    reserveAmmo: 0,
    bodyDamage: 6,
    headDamage: 8,
    reloadMs: 0,
    fireDelayMs: 100,
    fireMode: 'Beam',
    range: 90,
  },
  rocketLauncher: {
    rarity: 'epic',
    name: 'Comet Launcher',
    magazineSize: 1,
    reserveAmmo: 5,
    bodyDamage: 34,
    headDamage: 34,
    directDamage: 67,
    reloadMs: 2400,
    fireDelayMs: 1000,
    fireMode: 'Semi',
    range: 120,
  },
  molotov: {
    rarity: 'rare',
    name: 'Ember Molotov',
    magazineSize: 1,
    reserveAmmo: 0,
    bodyDamage: 5,
    headDamage: 5,
    reloadMs: 0,
    fireDelayMs: 500,
    fireMode: 'Utility',
    range: 3,
  },
  grenade: {
    rarity: 'uncommon',
    name: 'Pulse Grenade',
    magazineSize: 1,
    reserveAmmo: 0,
    bodyDamage: 34,
    headDamage: 34,
    reloadMs: 0,
    fireDelayMs: 500,
    fireMode: 'Utility',
    range: 4,
  },
  sword: {
    rarity: 'common',
    name: 'Vector Sword',
    magazineSize: 0,
    reserveAmmo: 0,
    bodyDamage: 20,
    headDamage: 20,
    reloadMs: 0,
    fireDelayMs: 500,
    fireMode: 'Melee',
    range: 3,
  },
  orbiter: {
    rarity: 'epic',
    name: 'Orbiter',
    magazineSize: 0,
    reserveAmmo: 0,
    bodyDamage: 35,
    headDamage: 35,
    reloadMs: 0,
    fireDelayMs: 650,
    fireMode: 'Melee',
    range: 3,
  },
  assaultRifle: {
    rarity: 'common',
    name: 'Kestrel AR',
    magazineSize: 20,
    reserveAmmo: 100,
    bodyDamage: 12,
    headDamage: 15,
    reloadMs: 1650,
    fireDelayMs: 125,
    fireMode: 'Auto',
    range: 160,
  },
  pistol: {
    rarity: 'common',
    name: 'Vesper Pistol',
    magazineSize: 8,
    reserveAmmo: 32,
    bodyDamage: 10,
    headDamage: 14,
    reloadMs: 1500,
    fireDelayMs: 400,
    fireMode: 'Semi',
    range: 130,
  },
  sniper: {
    rarity: 'epic',
    name: 'Meridian Sniper',
    magazineSize: 5,
    reserveAmmo: 15,
    bodyDamage: 34,
    headDamage: 100,
    reloadMs: 2400,
    fireDelayMs: 1200,
    fireMode: 'Semi',
    range: 240,
  },
} as const;

export type WeaponId = keyof typeof WEAPON_DEFINITIONS;
export type PrimaryWeaponId =
  | 'assaultRifle'
  | 'sniper'
  | 'rocketLauncher'
  | 'laserCannon';
export type MeleeWeaponId = 'sword' | 'orbiter';
export type WeaponHitZone = 'body' | 'head' | 'direct' | 'splash';
export type WeaponHit = 'none' | 'body' | 'head';

export function getWeaponDamage(weaponId: WeaponId, hitZone: WeaponHitZone) {
  if (weaponId === 'rocketLauncher' && hitZone === 'direct')
    return WEAPON_DEFINITIONS.rocketLauncher.directDamage;
  return WEAPON_DEFINITIONS[weaponId][
    hitZone === 'head' ? 'headDamage' : 'bodyDamage'
  ];
}

// This is shared by every target, so players and bots receive identical damage.
export function applyWeaponDamage(
  health: number,
  weaponId: WeaponId,
  hitZone: WeaponHitZone,
) {
  return Math.max(0, health - getWeaponDamage(weaponId, hitZone));
}
