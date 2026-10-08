import { Vector3 } from '@babylonjs/core';
import { teamOf } from './teams';
import type { BotNavigation } from './createBotNavigation';

export type BotActor = {
  slot: number;
  alive: boolean;
  position: Vector3;
  target?: number;
};
export function createTeamBotBrain(
  slot: number,
  size: number,
  scale: number,
  navigation: BotNavigation,
  visible: (position: Vector3) => boolean,
) {
  const index = slot % size,
    side = teamOf(slot, size) === 0 ? 1 : -1;
  const lane = [0, -12, 12, -6, 6][index] * scale;
  const role = index === 0 ? 'assault' : index < 3 ? 'flanker' : 'anchor';
  const preferredRange = role === 'anchor' ? 16 : role === 'flanker' ? 10 : 12;
  const phase = slot * 2.39996,
    decisionMs = 330 + ((slot * 97) % 220);
  let target = -1,
    nextDecision = 0,
    lastSeen: Vector3 | null = null,
    seenAt = -Infinity;
  let goal: Vector3 | null = null,
    path: Vector3[] = [],
    patrol = 0,
    coverUntil = 0,
    nextCoverAt = 0;
  let routeGoal: Vector3 | null = null;
  const patrolGoals = [
    new Vector3(lane, 1, side * -9 * scale),
    new Vector3(lane, 1, side * 6 * scale),
    new Vector3(lane * 0.65, 1, side * 13 * scale),
  ];
  function reset() {
    target = -1;
    nextDecision = 0;
    lastSeen = null;
    seenAt = -Infinity;
    goal = null;
    path = [];
    patrol = 0;
    coverUntil = 0;
    nextCoverAt = 0;
    routeGoal = null;
  }
  function plan(
    position: Vector3,
    health: number,
    actors: readonly BotActor[],
    now: number,
  ) {
    const friends = actors.filter(
      (a) =>
        a.alive &&
        a.slot !== slot &&
        teamOf(a.slot, size) === teamOf(slot, size),
    );
    const enemies = actors.filter(
      (a) => a.alive && teamOf(a.slot, size) !== teamOf(slot, size),
    );
    const seen = enemies.filter(
      (a) =>
        Vector3.DistanceSquared(position, a.position) < 27 ** 2 &&
        visible(a.position.add(new Vector3(0, 0.8, 0))),
    );
    let chosen = seen.find((a) => a.slot === target);
    const decide = now >= nextDecision || (target !== -1 && !chosen);
    if (decide) {
      // Prefer exposed enemies, retain a useful target, and share pressure across opponents.
      const score = (a: BotActor) =>
        Vector3.Distance(position, a.position) +
        friends.filter((f) => f.target === a.slot).length * 5 -
        (a.slot === target ? 4 : 0) +
        ((a.slot + slot) % size) * 0.7;
      chosen = seen.slice().sort((a, b) => score(a) - score(b))[0];
      target = chosen?.slot ?? -1;
      nextDecision = now + decisionMs;
    }
    if (chosen) {
      lastSeen = chosen.position.clone();
      seenAt = now;
    }
    if (decide || !goal) {
      if (now < coverUntil && goal) {
        // Finish the brief retreat even after the cover breaks line of sight.
      } else if (chosen) {
        const toward = chosen.position.subtract(position);
        toward.y = 0;
        const distance = toward.length();
        toward.normalize();
        const perpendicular = new Vector3(-toward.z, 0, toward.x);
        if (health <= 35 && now >= nextCoverAt) {
          const candidates: { position: Vector3; score: number }[] = [];
          for (let x = -6; x <= 6; x += 2)
            for (let z = -6; z <= 6; z += 2) {
              const p = position.add(new Vector3(x, 0, z)),
                d = Math.hypot(x, z);
              if (
                d < 2 ||
                d > 7 ||
                !navigation.walkable(p) ||
                friends.some(
                  (f) => Vector3.DistanceSquared(p, f.position) < 2.25,
                )
              )
                continue;
              if (
                navigation.visible(
                  p.add(new Vector3(0, 0.8, 0)),
                  chosen.position.add(new Vector3(0, 0.8, 0)),
                )
              )
                continue;
              const away = Vector3.Distance(p, chosen.position) - distance;
              candidates.push({ position: p, score: d - away * 0.7 });
            }
          const cover = candidates
            .sort((a, b) => a.score - b.score)
            .slice(0, 6)
            .find(
              (candidate) =>
                navigation.route(position, candidate.position).length,
            )?.position;
          if (cover) {
            goal = cover;
            coverUntil = now + 1100 + slot * 53;
            nextCoverAt = coverUntil + 1600;
          }
        }
        if (now >= coverUntil) {
          const flank =
            role === 'flanker'
              ? (index === 1 ? -1 : 1) * 4
              : Math.sin(now / 1500 + phase) * 2;
          goal = chosen.position
            .subtract(toward.scale(preferredRange))
            .add(perpendicular.scale(flank));
          goal.y = 1;
        }
      } else if (lastSeen && now - seenAt < 3500) {
        goal = lastSeen.add(new Vector3((index - (size - 1) / 2) * 2, 0, 0));
      } else {
        if (Vector3.DistanceSquared(position, patrolGoals[patrol]) < 4)
          patrol = (patrol + 1) % patrolGoals.length;
        goal = patrolGoals[patrol].clone();
      }
      if (
        !routeGoal ||
        Vector3.DistanceSquared(routeGoal, goal!) > 9 ||
        !path.length ||
        !navigation.clear(position, path[0])
      ) {
        path = navigation.route(position, goal!);
        routeGoal = goal!.clone();
      }
    }
    while (path.length && Vector3.DistanceSquared(position, path[0]) < 1)
      path.shift();
    let movement = (path[0] ?? position).subtract(position);
    movement.y = 0;
    if (chosen && now >= coverUntil) {
      const toward = chosen.position.subtract(position);
      toward.y = 0;
      const distance = toward.length();
      toward.normalize();
      if (Math.abs(distance - preferredRange) < 3) {
        movement = new Vector3(-toward.z, 0, toward.x).scale(
          Math.sin(now * (0.0014 + index * 0.00011) + phase),
        );
      }
    }
    const separation = Vector3.Zero();
    for (const friend of friends) {
      const away = position.subtract(friend.position);
      away.y = 0;
      const distance = away.length();
      if (distance < 2.4) {
        if (distance < 0.01) away.set(Math.cos(phase), 0, Math.sin(phase));
        separation.addInPlace(away.normalize().scale((2.4 - distance) / 2.4));
      }
    }
    if (movement.lengthSquared() > 0.001) movement.normalize();
    movement = navigation.steer(position, movement.add(separation.scale(1.8)));
    let canFire = Boolean(chosen) && now >= coverUntil;
    if (chosen) {
      const line = chosen.position.subtract(position),
        lengthSquared = line.lengthSquared();
      for (const friend of friends) {
        const t =
          Vector3.Dot(friend.position.subtract(position), line) / lengthSquared;
        if (
          t > 0 &&
          t < 1 &&
          Vector3.DistanceSquared(
            friend.position,
            position.add(line.scale(t)),
          ) <
            0.8 ** 2
        )
          canFire = false;
      }
    }
    return {
      target: chosen ?? null,
      movement,
      canFire,
      role,
      goal: goal?.clone(),
    };
  }
  return { plan, reset, reactionOffset: (slot * 37) % 140 };
}
