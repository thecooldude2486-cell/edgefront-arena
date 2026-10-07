import type { ArenaMapId } from './maps';
export const FALL_DEATH_Y = -8;
export const BARREL_HEALTH = 45;
export const BARREL_RADIUS = 7;
export type EnvironmentState = { seconds: number; barrelHealth: number[] };
export function barrelLocations(_map: ArenaMapId) {
  return [
    { x: -11, y: 0.7, z: -2 },
    { x: 11, y: 0.7, z: 2 },
    { x: -14, y: 0.7, z: -23 },
    { x: 14, y: 0.7, z: 23 },
  ];
}
export function newEnvironment(map: ArenaMapId): EnvironmentState {
  return {
    seconds: 0,
    barrelHealth: barrelLocations(map).map(() => BARREL_HEALTH),
  };
}
// Analytic motion keeps collision, carrying and server rays on the same path.
export function ferryPosition(side: number, seconds: number) {
  const travel = (1 - Math.cos((seconds * Math.PI * 2) / 10)) / 2;
  return {
    x: side * 14,
    y: 0.15 + travel * 1.45,
    z: side * (25.8 + travel * 6.5),
  };
}
export function barrelDamage(distance: number) {
  if (!Number.isFinite(distance) || distance >= BARREL_RADIUS) return 0;
  return Math.round(
    100 *
      Math.min(
        1,
        (BARREL_RADIUS - Math.max(0, distance)) / (BARREL_RADIUS - 1.25),
      ),
  );
}
export function readEnvironment(value: unknown): EnvironmentState | null {
  const data = value as EnvironmentState;
  if (
    !data ||
    !Number.isFinite(data.seconds) ||
    data.seconds < 0 ||
    !Array.isArray(data.barrelHealth) ||
    data.barrelHealth.length !== 4 ||
    !data.barrelHealth.every(
      (hp) => Number.isFinite(hp) && hp >= 0 && hp <= BARREL_HEALTH,
    )
  )
    return null;
  return { seconds: data.seconds, barrelHealth: [...data.barrelHealth] };
}
