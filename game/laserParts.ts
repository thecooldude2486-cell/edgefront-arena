export const LASER_PARTS_KEY = 'edgefront-arena.laser-parts.v1';
// Stable IDs preserve discoveries when the lobby is updated later.
export const LASER_PARTS = [
  { id: 'cell', name: 'Power cell', x: -12, y: .9, z: -113 },
  { id: 'lens', name: 'Focus lens', x: 16, y: 1.2, z: -113 },
  { id: 'coil', name: 'Magnetic coil', x: -34, y: .9, z: -105 },
  { id: 'emitter', name: 'Emitter assembly', x: 34, y: .9, z: -104 },
  { id: 'regulator', name: 'Energy regulator', x: 14, y: .9, z: -82 },
] as const;
export type LaserPartId = typeof LASER_PARTS[number]['id'];
export function createLaserPartsProgress(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  const found = new Set<LaserPartId>();
  let saved = Boolean(storage);
  try {
    const data: unknown = JSON.parse(storage?.getItem(LASER_PARTS_KEY) ?? '[]');
    if (Array.isArray(data)) for (const part of LASER_PARTS) if (data.includes(part.id)) found.add(part.id);
  } catch { saved = false; /* Unreadable saves never grant an unlock or affect the Orb wallet. */ }
  return {
    get state() { return { found: [...found], count: found.size, unlocked: found.size === LASER_PARTS.length, saved }; },
    collect(id: LaserPartId) {
      if (!LASER_PARTS.some(part => part.id === id) || found.has(id)) return false;
      found.add(id);
      try { storage?.setItem(LASER_PARTS_KEY, JSON.stringify([...found])); saved = Boolean(storage); }
      catch { saved = false; }
      return true;
    },
  };
}
