import { KILLCAM_SECONDS } from './teams.ts';
import { readEnvironment, type EnvironmentState } from './arenaEnvironment.ts';
import type { PlayerPose } from './onlineMovement';
import { isArenaMapId, type ArenaMapId } from './maps.ts';
import { WEAPON_DEFINITIONS, type WeaponId } from './weaponDefinitions.ts';
import type { EliminationPerformance } from './combatXp';
export type ReplayActor = {
  pose: PlayerPose;
  health: number;
  weapon: WeaponId;
};
export type ReplayFrame = {
  environment?: EnvironmentState;
  at: number;
  actors: [ReplayActor, ReplayActor];
  shot?: {
    actor: number;
    origin: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
  };
};
export type KillReplay = {
  botActor?: number;
  mapId: ArenaMapId;
  killer: number;
  frames: ReplayFrame[];
  barrelHealth: number[];
  environmentSeconds: number;
};
export function createReplayBuffer() {
  let frames: ReplayFrame[] = [];
  return {
    reset() {
      frames = [];
    },
    capture(
      at: number,
      actors: [ReplayActor, ReplayActor],
      shot?: ReplayFrame['shot'],
      environment?: EnvironmentState,
      force = false,
    ) {
      if (!force && !shot && frames.length && at - frames.at(-1)!.at < 100)
        return;
      frames.push({
        at,
        ...(environment
          ? {
              environment: {
                seconds: environment.seconds,
                barrelHealth: [...environment.barrelHealth],
              },
            }
          : {}),
        actors: actors.map((a) => ({
          ...a,
          pose: { ...a.pose },
        })) as ReplayFrame['actors'],
        ...(shot ? { shot } : {}),
      });
      while (
        frames.length > 1 &&
        (frames.length > 80 || at - frames[0].at > KILLCAM_SECONDS * 1000)
      )
        frames.shift();
    },
    read(
      mapId: ArenaMapId,
      killer: number,
      barrelHealth: number[],
      environmentSeconds: number,
    ): KillReplay | null {
      if (frames.length < 1) return null;
      const start = frames[0].at;
      return {
        mapId,
        killer,
        barrelHealth: [...barrelHealth],
        environmentSeconds,
        frames: frames.map((f) => ({
          ...f,
          at: (f.at - start) / 1000,
          actors: f.actors.map((a) => ({
            ...a,
            pose: { ...a.pose },
          })) as ReplayFrame['actors'],
        })),
      };
    },
  };
}
export function readKillReplay(value: unknown): KillReplay | null {
  const data = value as KillReplay;
  const vector = (p: unknown) =>
    !!p &&
    typeof p === 'object' &&
    ['x', 'y', 'z'].every(
      (k) =>
        Number.isFinite((p as Record<string, number>)[k]) &&
        Math.abs((p as Record<string, number>)[k]) <= 200,
    );
  if (
    !data ||
    (data.botActor !== undefined && ![0, 1].includes(data.botActor)) ||
    !isArenaMapId(data.mapId) ||
    ![0, 1].includes(data.killer) ||
    !Array.isArray(data.frames) ||
    !data.frames.length ||
    data.frames.length > 80 ||
    !Number.isFinite(data.environmentSeconds) ||
    !Array.isArray(data.barrelHealth) ||
    data.barrelHealth.length !== 4 ||
    !data.barrelHealth.every((h) => Number.isFinite(h) && h >= 0 && h <= 45)
  )
    return null;
  let previous = -1;
  for (const f of data.frames) {
    if (
      !Number.isFinite(f.at) ||
      f.at < previous ||
      f.at < 0 ||
      f.at > 4.2 ||
      !Array.isArray(f.actors) ||
      f.actors.length !== 2
    )
      return null;
    previous = f.at;
    for (const a of f.actors) {
      if (
        !a ||
        !vector(a.pose) ||
        !Number.isFinite(a.pose.yaw) ||
        !Number.isFinite(a.pose.pitch) ||
        !Number.isFinite(a.health) ||
        a.health < 0 ||
        a.health > 100 ||
        !Object.hasOwn(WEAPON_DEFINITIONS, a.weapon)
      )
        return null;
    }
    if (f.environment && !readEnvironment(f.environment)) return null;
    if (
      f.shot &&
      (![0, 1].includes(f.shot.actor) ||
        !vector(f.shot.origin) ||
        !vector(f.shot.direction))
    )
      return null;
  }
  return data;
}
export function readKillerStats(
  value: unknown,
): EliminationPerformance | undefined {
  const data = value as EliminationPerformance;
  if (
    !data ||
    ![
      'damageDealt',
      'healthRemaining',
      'distance',
      'shots',
      'hits',
      'seconds',
    ].every(
      (k) =>
        Number.isFinite(data[k as keyof EliminationPerformance]) &&
        Number(data[k as keyof EliminationPerformance]) >= 0,
    )
  )
    return undefined;
  return data;
}
