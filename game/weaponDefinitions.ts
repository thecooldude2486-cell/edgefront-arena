export const WEAPON_DEFINITIONS = {
  assaultRifle: {
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
} as const;

export type WeaponId = keyof typeof WEAPON_DEFINITIONS;
export type WeaponHitZone = 'body' | 'head';
export type WeaponHit = 'none' | WeaponHitZone;

export function getWeaponDamage(weaponId: WeaponId, hitZone: WeaponHitZone) {
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
