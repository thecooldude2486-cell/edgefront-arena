import { WEAPON_DEFINITIONS } from '../game/weaponDefinitions.ts';
export const RECONNECT_GRACE_MS = 30000;
export const MAX_REWIND_MS = 250;
export const VIEW_SMOOTHING_MS = 70;
export function recordPose(player, pose, now) {
  player.pose = { ...pose };
  player.history ??= [];
  player.history.push({ at: now, pose: { ...pose } });
  player.history = player.history
    .filter((sample) => sample.at >= now - 600)
    .slice(-64);
}
export function historicalPose(player, time) {
  const samples = player.history ?? [];
  if (!samples.length) return player.pose;
  if (time < samples[0].at) return null; // Never extrapolate to a pose we didn't record.
  for (let index = 1; index < samples.length; index++) {
    const before = samples[index - 1],
      after = samples[index];
    if (after.at >= time) {
      const mix =
        after.at === before.at
          ? 1
          : (time - before.at) / (after.at - before.at);
      return Object.fromEntries(
        ['x', 'y', 'z', 'yaw', 'pitch'].map((key) => [
          key,
          before.pose[key] + (after.pose[key] - before.pose[key]) * mix,
        ]),
      );
    }
  }
  return samples.at(-1).pose;
}
export function compensatedPose(target, socket, now) {
  if (!Number.isFinite(socket.rttMs) || now - (socket.lastNetAck ?? 0) > 10000)
    return target.pose;
  // Opponent updates travel to the shooter, then the shot travels back.
  // Rewind their combined network delay plus the client smoothing interval.
  return (
    historicalPose(
      target,
      now - Math.min(MAX_REWIND_MS, socket.rttMs + VIEW_SMOOTHING_MS),
    ) ?? target.pose
  );
}
export function pauseCombat(player) {
  // Never replay transient projectiles or partially completed reloads on resume.
  player.projectiles = [];
  player.fires = [];
  player.reloadAt = 0;
  for (const supply of Object.values(player.inventory)) supply.reloadAt = 0;
  player.history = [];
}
export function resumeCombat(player, duration, now) {
  if (Number.isFinite(player.lastShot)) player.lastShot += duration;
  if (player.energyUpdatedAt !== null) player.energyUpdatedAt = now;
  for (const supply of Object.values(player.inventory))
    if (Number.isFinite(supply.lastShot)) supply.lastShot += duration;
  player.performance.delay(duration);
  if (player.pose) recordPose(player, player.pose, now);
}
export function combatSnapshot(player, now = Date.now()) {
  const inventory = Object.fromEntries(
    Object.entries(player.inventory).map(([id, supply]) => [
      id,
      {
        ammo: supply.ammo,
        reserve: supply.reserve,
        cooldownMs: Math.max(
          0,
          supply.lastShot + WEAPON_DEFINITIONS[id].fireDelayMs - now,
        ),
      },
    ]),
  );
  inventory[player.supplyWeapon] = {
    ammo: player.ammo,
    reserve: player.reserve,
    cooldownMs: Math.max(
      0,
      player.lastShot +
        WEAPON_DEFINITIONS[player.supplyWeapon].fireDelayMs -
        now,
    ),
  };
  return {
    ...(player.loadout ? { loadout: player.loadout } : {}),
    health: player.health,
    weapon: player.weapon,
    pose: player.pose,
    ready: player.ready,
    sequence: player.sequence,
    inventory,
  };
}
