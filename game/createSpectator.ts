import { Ray, UniversalCamera, Vector3, type Scene } from '@babylonjs/core';
import type { PlayerPose } from './onlineMovement';
import type { WeaponId } from './weaponDefinitions';

export type MatchParticipant = {
  slot: number;
  team: number;
  name: string;
  health: number;
  connected: boolean;
  weapon: WeaponId;
  level?: number;
  kills?: number;
  deaths?: number;
};
export type SpectatorState = {
  target: MatchParticipant | null;
  options: MatchParticipant[];
};
export type SpectatorActor = MatchParticipant & {
  pose: () => PlayerPose | null;
};

// A separate camera keeps the eliminated player's aim, collider and network pose intact.
export function createSpectator(
  scene: Scene,
  onChange: (state: SpectatorState | null) => void,
) {
  const camera = new UniversalCamera(
    'spectator shoulder camera',
    Vector3.Zero(),
    scene,
  );
  camera.minZ = 0.05;
  camera.fov = 1.05;
  let active = false,
    actors: SpectatorActor[] = [],
    selected: number | null = null;
  let previousCamera = scene.activeCamera;
  let published = '';
  let followedSlot: number | null = null;
  let followedPose: PlayerPose | null = null;
  let boomFraction = 1;
  const participant = ({
    pose: _pose,
    ...entry
  }: SpectatorActor): MatchParticipant => entry;
  function notify() {
    const state = active
      ? {
          target: actors.find((a) => a.slot === selected)
            ? participant(actors.find((a) => a.slot === selected)!)
            : null,
          options: actors.map(participant),
        }
      : null;
    const signature = JSON.stringify(state);
    if (signature !== published) {
      published = signature;
      onChange(state);
    }
  }
  function stop() {
    if (active) scene.activeCamera = previousCamera;
    active = false;
    selected = null;
    followedSlot = null;
    followedPose = null;
    boomFraction = 1;
    notify();
  }
  function select(slot: number) {
    if (!active || !actors.some((a) => a.slot === slot)) return;
    selected = slot;
    notify();
  }
  return {
    get active() {
      return active;
    },
    get targetSlot() {
      return selected;
    },
    get camera() {
      return camera;
    },
    setRoster(roster: SpectatorActor[], localSlot: number, roundOver = false) {
      const team = roster.find((a) => a.slot === localSlot)?.team;
      actors = roster.filter(
        (a) =>
          a.slot !== localSlot &&
          a.connected &&
          a.health > 0 &&
          a.pose() &&
          (roundOver || a.team === team),
      );
      if (!actors.some((a) => a.slot === selected))
        selected = actors[0]?.slot ?? null;
      notify();
    },
    start() {
      if (active) return;
      previousCamera = scene.activeCamera;
      if (previousCamera) {
        camera.position.copyFrom(previousCamera.position);
        if (previousCamera instanceof UniversalCamera)
          camera.rotation.copyFrom(previousCamera.rotation);
      }
      active = true;
      selected = actors[0]?.slot ?? null;
      scene.activeCamera = camera;
      notify();
    },
    select,
    cycle(direction: number) {
      if (!active || actors.length === 0) return;
      const index = actors.findIndex((a) => a.slot === selected);
      select(
        actors[
          (index + (direction < 0 ? -1 : 1) + actors.length) % actors.length
        ].slot,
      );
    },
    update(seconds: number) {
      if (!active) return;
      const pose = actors.find((a) => a.slot === selected)?.pose();
      if (!pose) return;
      const dt = Number.isFinite(seconds)
        ? Math.max(0, Math.min(0.1, seconds))
        : 0;
      // Target changes and teleports cut to the new player; ordinary movement eases
      // at the same rate at any frame rate, including turns across ±pi.
      if (
        !followedPose ||
        followedSlot !== selected ||
        Math.hypot(
          pose.x - followedPose.x,
          pose.y - followedPose.y,
          pose.z - followedPose.z,
        ) > 12
      ) {
        followedSlot = selected;
        followedPose = { ...pose };
        boomFraction = 1;
      } else {
        const blend = 1 - Math.exp(-10 * dt);
        const yawDelta = Math.atan2(
          Math.sin(pose.yaw - followedPose.yaw),
          Math.cos(pose.yaw - followedPose.yaw),
        );
        followedPose = {
          x: followedPose.x + (pose.x - followedPose.x) * blend,
          y: followedPose.y + (pose.y - followedPose.y) * blend,
          z: followedPose.z + (pose.z - followedPose.z) * blend,
          yaw: followedPose.yaw + yawDelta * blend,
          pitch: followedPose.pitch + (pose.pitch - followedPose.pitch) * blend,
        };
      }
      const follow = followedPose;
      const forward = new Vector3(
        Math.sin(follow.yaw),
        0,
        Math.cos(follow.yaw),
      );
      const focus = new Vector3(follow.x, follow.y + 0.65, follow.z);
      // Test cover from the actual player rather than the lagging follow position.
      const anchor = new Vector3(pose.x, pose.y + 0.65, pose.z);
      const eye = focus
        .subtract(forward.scale(3.6))
        .add(new Vector3(Math.cos(follow.yaw), 1.15, -Math.sin(follow.yaw)));
      const delta = eye.subtract(anchor),
        direction = delta.normalizeToNew();
      const obstruction = scene.pickWithRay(
        new Ray(anchor, direction, delta.length()),
        (m) =>
          m.isEnabled() &&
          m.checkCollisions &&
          !m.metadata?.owner &&
          !m.name.includes('movement collider'),
      );
      const safeFraction = obstruction?.pickedPoint
        ? Math.max(
            0,
            (Vector3.Distance(anchor, obstruction.pickedPoint) - 0.2) /
              Math.max(0.001, delta.length()),
          )
        : 1;
      // Pull inward immediately for safety; ease outward so cover edges do not pop.
      boomFraction = Math.min(
        safeFraction,
        boomFraction + (1 - boomFraction) * (1 - Math.exp(-8 * dt)),
      );
      camera.position.copyFrom(anchor.add(delta.scale(boomFraction)));
      camera.setTarget(
        focus.add(
          new Vector3(
            forward.x * 9,
            -Math.sin(follow.pitch) * 9,
            forward.z * 9,
          ),
        ),
      );
    },
    stop,
    dispose() {
      stop();
      camera.dispose();
    },
  };
}
