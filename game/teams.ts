import { ARENA_MAPS, MODE_MAPS, type ArenaMapId } from './maps.ts';
export const INTERMISSION_MS = 3000;
export const KILLCAM_SECONDS = 3;
export type TeamSize = 1 | 2 | 3 | 4 | 5;
export function isTeamSize(value: unknown): value is TeamSize {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}
export type TeamPreference = 'auto' | 0 | 1;
// Reconnect reservations count as occupied. A preference never increases team capacity.
export function selectTeamSlot(
  occupied: readonly unknown[],
  size: number,
  preference: unknown = 'auto',
): number {
  if (!isTeamSize(size) || occupied.length !== size * 2) return -1;
  if (size === 1 || (preference !== 0 && preference !== 1))
    return occupied.findIndex((value) => !value);
  for (const team of [preference, 1 - preference]) {
    for (let slot = team * size; slot < (team + 1) * size; slot++) {
      if (!occupied[slot]) return slot;
    }
  }
  return -1;
}

export function teamOf(slot: number, size: number) {
  return slot < size ? 0 : 1;
}
export function mapScale(map: ArenaMapId) {
  return 'scale' in ARENA_MAPS[map] ? Number(ARENA_MAPS[map].scale) : 1;
}
export function mapsForTeams(size: number): ArenaMapId[] {
  return [...MODE_MAPS[isTeamSize(size) ? size : 1]];
}
export function teamSpawn(slot: number, size: number, map: ArenaMapId) {
  const team = teamOf(slot, size),
    index = slot % size;
  return {
    x: (index - (size - 1) / 2) * 2.5,
    y: 0.95,
    z: (team === 0 ? -17 : 17) * mapScale(map),
    yaw: team === 0 ? 0 : Math.PI,
    pitch: 0,
  };
}
export function winningTeam(health: number[], size: number): number | null {
  if (health.length !== size * 2) return null;
  const alive = [
    health.slice(0, size).some((h) => h > 0),
    health.slice(size).some((h) => h > 0),
  ];
  return alive[0] === alive[1] ? null : alive[0] ? 0 : 1;
}
export function chooseVotedMap(
  size: number,
  votes: (ArenaMapId | null)[],
  tieSeed = 0,
): ArenaMapId {
  const choices = mapsForTeams(size),
    counts = choices.map((id) => votes.filter((v) => v === id).length),
    max = Math.max(...counts);
  const tied = choices.filter((_, i) => counts[i] === max);
  return tied[Math.abs(tieSeed) % tied.length];
}
