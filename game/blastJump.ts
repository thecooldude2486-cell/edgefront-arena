import { Vector3 } from '@babylonjs/core';

export const BLAST_JUMP = { radius: 4, upward: 14, forward: 10, airSteering: 12, maxHorizontalSpeed: 16 };

// Push away from the blast. Directly underneath: launch along the player's view.
export function getBlastImpulse(origin: Vector3, player: Vector3, yaw: number) {
  const away = player.subtract(origin);
  const distance = away.length();
  if (distance > BLAST_JUMP.radius) return null;
  const strength = 1 - .5 * Math.min(1, distance / BLAST_JUMP.radius);
  away.y = 0;
  if (away.lengthSquared() < .04) away.set(Math.sin(yaw), 0, Math.cos(yaw));
  away.normalize().scaleInPlace(BLAST_JUMP.forward * strength);
  away.y = BLAST_JUMP.upward * strength;
  return away;
}

// Keep blast momentum without input; WASD adds bounded air steering.
export function steerBlast(velocity: Vector3, input: Vector3, dt: number) {
  const next = velocity.clone(); next.y = 0;
  if (input.lengthSquared() > 0) next.addInPlace(input.normalizeToNew().scale(BLAST_JUMP.airSteering * dt));
  const speed = next.length();
  if (speed > BLAST_JUMP.maxHorizontalSpeed) next.scaleInPlace(BLAST_JUMP.maxHorizontalSpeed / speed);
  return next;
}
