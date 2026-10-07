import { WEAPON_DEFINITIONS, type WeaponId } from './weaponDefinitions.ts';

type Point = { x: number; y: number; z: number };
export type OnlineEffect = { action: 'fire' | 'reload' | 'reloadEnd'; weapon: WeaponId; origin?: Point; direction?: Point };

// Validate weapon requests and strip extra fields; the server determines damage.
export function readOnlineEffect(value: unknown): OnlineEffect | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as OnlineEffect;
  if (typeof data.weapon !== 'string' || !Object.hasOwn(WEAPON_DEFINITIONS, data.weapon)) return null;
  if (data.action === 'reload' || data.action === 'reloadEnd') {
    const stats = WEAPON_DEFINITIONS[data.weapon];
    if (stats.reloadMs <= 0 || stats.magazineSize <= 0 || stats.fireMode === 'Utility') return null;
    return { action: data.action, weapon: data.weapon };
  }
  if (data.action !== 'fire') return null;
  const { origin: o, direction: d } = data;
  const finite = (v: Point | undefined) => v && [v.x,v.y,v.z].every(n => typeof n === 'number' && Number.isFinite(n));
  if (!finite(o) || !finite(d) || !o || !d) return null;
  if (Math.abs(o.x)>100 || Math.abs(o.z)>100 || o.y < -20 || o.y>100 || Math.abs(Math.hypot(d.x,d.y,d.z)-1)>.01) return null;
  return { action: 'fire', weapon: data.weapon, origin: { x:o.x,y:o.y,z:o.z }, direction: { x:d.x,y:d.y,z:d.z } };
}
