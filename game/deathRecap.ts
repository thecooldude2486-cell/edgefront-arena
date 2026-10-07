import { readPlayerProfile } from './progression.ts';
import {
  readKillReplay,
  readKillerStats,
  type KillReplay,
} from './killReplay.ts';
import type { EliminationPerformance } from './combatXp';
import {
  WEAPON_DEFINITIONS,
  type WeaponId,
  type WeaponHitZone,
} from './weaponDefinitions.ts';
export type DamageSource = WeaponId | 'fall' | 'oilBarrel';
export const damageSourceName = (id: DamageSource) =>
  id === 'fall'
    ? 'Fall into the void'
    : id === 'oilBarrel'
      ? 'Explosive oil barrel'
      : WEAPON_DEFINITIONS[id].name;
const validSource = (id: string) =>
  id === 'fall' || id === 'oilBarrel' || Object.hasOwn(WEAPON_DEFINITIONS, id);
export type DeathRecap = {
  replay?: KillReplay | null;
  replayProfiles?: NonNullable<ReturnType<typeof readPlayerProfile>>[];
  killerStats?: EliminationPerformance;
  killer: string;
  killerHealth: number;
  damageDealt: number;
  totalDamage: number;
  hits: {
    weapon: DamageSource;
    damage: number;
    count: number;
    headshots: number;
  }[];
  finalHit: {
    weapon: DamageSource;
    zone: WeaponHitZone;
    distance: number;
  } | null;
};
export function createDeathRecap() {
  let hits: DeathRecap['hits'] = [],
    finalHit: DeathRecap['finalHit'] = null;
  return {
    reset() {
      hits = [];
      finalHit = null;
    },
    record(
      weapon: DamageSource,
      zone: WeaponHitZone,
      before: number,
      after: number,
      distance: number,
    ) {
      const amount = Math.max(0, Math.min(100, before) - Math.max(0, after));
      if (!Number.isFinite(amount) || amount <= 0) return;
      const row = hits.find((hit) => hit.weapon === weapon);
      if (row) {
        row.damage += amount;
        row.count++;
        if (zone === 'head') row.headshots++;
      } else
        hits.push({
          weapon,
          damage: amount,
          count: 1,
          headshots: zone === 'head' ? 1 : 0,
        });
      finalHit = {
        weapon,
        zone,
        distance: Math.max(0, Number.isFinite(distance) ? distance : 0),
      };
    },
    read(
      killer: string,
      killerHealth: number,
      damageDealt: number,
    ): DeathRecap {
      return {
        killer,
        killerHealth: Math.max(0, Math.min(100, killerHealth)),
        damageDealt: Math.max(0, Math.min(100, damageDealt)),
        totalDamage: hits.reduce((sum, row) => sum + row.damage, 0),
        hits: hits.map((row) => ({ ...row })),
        finalHit: finalHit ? { ...finalHit } : null,
      };
    },
  };
}
export function readDeathRecap(value: unknown): DeathRecap | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as DeathRecap;
  if (
    typeof data.killer !== 'string' ||
    data.killer.length > 32 ||
    ![data.killerHealth, data.damageDealt, data.totalDamage].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 100,
    ) ||
    !Array.isArray(data.hits) ||
    data.hits.length > 12
  )
    return null;
  if (
    data.hits.some(
      (row) =>
        !row ||
        !validSource(row.weapon) ||
        !Number.isFinite(row.damage) ||
        row.damage <= 0 ||
        row.damage > 100 ||
        !Number.isSafeInteger(row.count) ||
        row.count < 1 ||
        !Number.isInteger(row.headshots) ||
        row.headshots < 0 ||
        row.headshots > row.count,
    )
  )
    return null;
  if (
    !data.finalHit ||
    !validSource(data.finalHit.weapon) ||
    !['body', 'head', 'direct', 'splash'].includes(data.finalHit.zone) ||
    !Number.isFinite(data.finalHit.distance) ||
    data.finalHit.distance < 0
  )
    return null;
  if (
    Math.abs(
      data.hits.reduce((sum, row) => sum + row.damage, 0) - data.totalDamage,
    ) > 0.01
  )
    return null;
  return {
    ...data,
    replay: readKillReplay(data.replay),
    replayProfiles:
      Array.isArray(data.replayProfiles) && data.replayProfiles.length === 2
        ? data.replayProfiles
            .map((p) => readPlayerProfile(p))
            .filter((p): p is NonNullable<typeof p> => p !== null)
        : undefined,
    killerStats: readKillerStats(data.killerStats),
  };
}
