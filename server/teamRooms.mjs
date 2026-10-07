import { randomBytes, randomInt } from 'node:crypto';
import { Vector3 } from '@babylonjs/core';
import {
  createHitWorld,
  newCombatPlayer,
  checkCombatEffect,
  equipCombatWeapon,
  updateCombat,
  clearCombat,
} from './combat.mjs';
import {
  isTeamSize,
  mapsForTeams,
  teamOf,
  teamSpawn,
  chooseVotedMap,
  winningTeam,
  INTERMISSION_MS,
} from '../game/teams.ts';
import {
  newEnvironment,
  barrelDamage,
  FALL_DEATH_Y,
} from '../game/arenaEnvironment.ts';
import { createReplayBuffer } from '../game/killReplay.ts';
import { readPlayerProfile, EMPTY_COSMETICS } from '../game/progression.ts';
import { readOnlineEffect } from '../game/onlineEffects.ts';
import { readOnlineLoadout } from '../game/onlineSnapshot.ts';
import {
  recordPose,
  compensatedPose,
  combatSnapshot,
  pauseCombat,
  resumeCombat,
} from './reliability.mjs';
import { playerNameError } from '../game/playerName.ts';
const defaultProfile = () => ({ level: 1, cosmetics: { ...EMPTY_COSMETICS } });
export function createTeamRooms(send) {
  const rooms = new Map(),
    tokens = new Map(),
    worlds = new Map();
  const roomFor = (s) => rooms.get(s.teamCode);
  function publicList() {
    return [...rooms.values()]
      .filter((r) => r.visibility === 'public')
      .map((r) => ({
        code: r.code,
        size: r.size,
        players: r.peers.filter(Boolean).length,
        phase: r.phase,
      }));
  }
  function state(r, s) {
    const slot = r.peers.indexOf(s);
    if (slot < 0) return;
    send(s, {
      type: 'teamState',
      code: r.code,
      slot,
      token: r.tokens[slot],
      size: r.size,
      players: r.combat.map((p, i) => ({
        slot: i,
        name: r.names[i],
        connected: !!r.peers[i],
        ready: p.ready,
        health: p.health,
        pose: p.pose,
        weapon: p.weapon,
        kills: r.kills[i],
        deaths: r.deaths[i],
        profile: r.profiles[i],
      })),
      mapId: r.mapId,
      votes: r.votes,
      phase: r.phase,
      deadline: r.deadline,
      paused: !!r.pausedAt,
      scores: r.scores,
      round: r.round,
      winner: r.winner,
      environment: r.environment,
      recap: r.recaps[slot],
      performance: r.combat[slot].performance.read(
        r.combat[slot].health,
        Date.now(),
      ),
    });
  }
  const broadcast = (r) => r.peers.forEach((s) => s && state(r, s));
  function capture(r, shot = null, force = false) {
    r.combat.forEach((victim, index) => {
      if (!victim.pose) return;
      const killer = r.lastKiller[index] ?? r.size;
      if (!r.combat[killer]?.pose) return;
      const actors = [victim, r.combat[killer]].map((p) => ({
        pose: p.pose,
        health: p.health,
        weapon: p.weapon,
      }));
      const event =
        shot && (shot.actor === index || shot.actor === killer)
          ? { ...shot, actor: shot.actor === index ? 0 : 1 }
          : undefined;
      r.replays[index].capture(Date.now(), actors, event, r.environment, force);
    });
  }
  // Replays for every possible enemy prevent an unseen killer from appearing only on the last frame.
  function capturePairs(r, shot) {
    for (let victim = 0; victim < r.size * 2; victim++)
      for (let killer = 0; killer < r.size * 2; killer++) {
        if (
          teamOf(victim, r.size) === teamOf(killer, r.size) ||
          !r.combat[victim].pose ||
          !r.combat[killer].pose
        )
          continue;
        const key = victim + ':' + killer;
        let buffer = r.pairs.get(key);
        if (!buffer) {
          buffer = createReplayBuffer();
          r.pairs.set(key, buffer);
        }
        buffer.capture(
          Date.now(),
          [r.combat[victim], r.combat[killer]].map((p) => ({
            pose: p.pose,
            health: p.health,
            weapon: p.weapon,
          })),
          shot && (shot.actor === victim || shot.actor === killer)
            ? { ...shot, actor: shot.actor === victim ? 0 : 1 }
            : undefined,
          r.environment,
        );
      }
  }
  function resetRound(r) {
    r.environment = newEnvironment(r.mapId);
    r.pairs.clear();
    r.recaps.fill(null);
    r.replays.forEach((b) => b.reset());
    r.combat = r.combat.map((old, slot) => {
      const p = newCombatPlayer();
      p.sequence = old.sequence;
      p.loadout = old.loadout;
      p.ready = !!r.tokens[slot];
      p.health = p.ready ? 100 : 0;
      p.pose = teamSpawn(slot, r.size, r.mapId);
      equipCombatWeapon(p, old.weapon);
      return p;
    });
    r.phase = 'playing';
    r.deadline = null;
    r.round++;
    r.winner = null;
    broadcast(r);
    r.peers.forEach(
      (s, i) =>
        s &&
        send(s, { type: 'teamSync', snapshot: combatSnapshot(r.combat[i]) }),
    );
  }
  function resolve(r, before, actor) {
    if (!['playing', 'intermission'].includes(r.phase)) return;
    const occupied = [0, 1].map((team) =>
      r.tokens.some((token, slot) => token && teamOf(slot, r.size) === team),
    );
    if (
      ['playing', 'intermission'].includes(r.phase) &&
      occupied[0] !== occupied[1]
    ) {
      r.winner = occupied[0] ? 0 : 1;
      r.scores[r.winner] = 5;
      r.phase = 'finished';
      r.deadline = null;
      r.combat.forEach((p) => {
        clearCombat(p);
        p.ready = false;
      });
      broadcast(r);
      return;
    }
    if (r.phase !== 'playing') return;
    r.combat.forEach((p, i) => {
      if (before[i] > 0 && p.health === 0) {
        r.deaths[i]++;
        const killer = r.lastKiller[i] ?? actor;
        if (
          killer !== null &&
          killer !== i &&
          teamOf(killer, r.size) !== teamOf(i, r.size)
        ) {
          r.kills[killer]++;
        }
        const other = killer ?? (i + r.size) % (r.size * 2);
        const cause = p.incomingDamage.read('', 0, 0).finalHit?.weapon;
        const buffer = r.pairs.get(i + ':' + other) ?? r.replays[i];
        capture(r, null, true);
        buffer.capture(
          Date.now(),
          [p, r.combat[other]].map((v) => ({
            pose: v.pose,
            health: v.health,
            weapon: v.weapon,
          })),
          undefined,
          r.environment,
          true,
        );
        r.recaps[i] = {
          ...p.incomingDamage.read(
            cause === 'fall'
              ? 'The void'
              : cause === 'oilBarrel'
                ? 'Oil barrel'
                : r.names[other],
            r.combat[other].health,
            p.performance.read(0, Date.now()).damageDealt,
          ),
          killerStats: r.combat[other].performance.read(
            r.combat[other].health,
            Date.now(),
          ),
          replay: buffer.read(
            r.mapId,
            1,
            r.environment.barrelHealth,
            r.environment.seconds,
          ),
          replayProfiles: [r.profiles[i], r.profiles[other]],
        };
        clearCombat(p);
      }
    });
    const winner = winningTeam(
        r.combat.map((p) => p.health),
        r.size,
      ),
      double = r.combat.every((p) => p.health === 0);
    if (winner !== null || double) {
      r.winner = winner;
      if (winner !== null) r.scores[winner]++;
      r.combat.forEach(clearCombat);
      r.phase =
        winner !== null && r.scores[winner] >= 5 ? 'finished' : 'intermission';
      if (r.phase === 'finished') r.combat.forEach((p) => (p.ready = false));
      r.deadline =
        r.phase === 'intermission' ? Date.now() + INTERMISSION_MS : null;
      broadcast(r);
    } else if (r.combat.some((p, i) => p.health !== before[i])) broadcast(r);
  }
  function worldFor(r, actor) {
    if (!worlds.has(r.mapId)) worlds.set(r.mapId, createHitWorld(r.mapId));
    const base = worlds.get(r.mapId);
    base.setEnvironment(r.environment, (point) => {
      r.combat.forEach((p, i) => {
        if (p.health <= 0 || !p.pose) return;
        const center = new Vector3(p.pose.x, p.pose.y, p.pose.z),
          distance = Vector3.Distance(point, center),
          amount = barrelDamage(distance);
        if (!amount || !base.visible(point, center)) return;
        const before = p.health;
        p.health = Math.max(0, before - amount);
        p.incomingDamage.record(
          'oilBarrel',
          'splash',
          before,
          p.health,
          distance,
        );
        if (p.health === 0) r.lastKiller[i] = actor;
        if (teamOf(actor, r.size) !== teamOf(i, r.size))
          r.combat[actor].performance.damage(before, p.health, false, distance);
      });
    });
    // Every ray tests every opposing body against the same cover. Damage uses the collider that won the query.
    const enemies = r.combat
      .map((p, slot) => ({ p, slot }))
      .filter(
        (v) =>
          v.p.health > 0 &&
          v.p.pose &&
          teamOf(v.slot, r.size) !== teamOf(actor, r.size),
      );
    let picked = null;
    return {
      ...base,
      get damageTarget() {
        return picked?.p ?? null;
      },
      sweep(origin, direction, distance) {
        let best = base.sweep(origin, direction, distance);
        picked = null;
        for (const e of enemies) {
          const pose =
              compensatedPose(e.p, r.peers[actor] ?? {}, Date.now()) ??
              e.p.pose,
            hit = base.sweep(origin, direction, distance, pose);
          if (
            hit &&
            ['body', 'head'].includes(hit.kind) &&
            (!best || hit.distance < best.distance)
          ) {
            best = hit;
            picked = e;
          }
        }
        if (picked) r.lastKiller[picked.slot] = actor;
        return best;
      },
      blastDamage(
        point,
        weapon,
        zone,
        origin,
        onHit,
        sequence,
        radius,
        excluded = null,
      ) {
        for (const e of enemies) {
          if (e.p === excluded || e.p.health <= 0) continue;
          const center = new Vector3(e.p.pose.x, e.p.pose.y, e.p.pose.z);
          if (
            Vector3.Distance(point, center) > radius ||
            !base.visible(point, center)
          )
            continue;
          const before = e.p.health;
          const amount = weapon === 'molotov' ? 5 : 34;
          e.p.health = Math.max(0, before - amount);
          e.p.incomingDamage.record(
            weapon,
            zone,
            before,
            e.p.health,
            Vector3.Distance(origin, center),
          );
          r.lastKiller[e.slot] = actor;
          r.combat[actor].performance.damage(
            before,
            e.p.health,
            false,
            Vector3.Distance(origin, center),
          );
          onHit('body', sequence);
        }
      },
    };
  }
  function leave(s, explicit = false) {
    const r = roomFor(s);
    if (!r) return;
    const slot = r.peers.indexOf(s);
    if (slot < 0) return;
    r.peers[slot] = null;
    s.teamCode = null;
    if (explicit) {
      tokens.delete(r.tokens[slot]);
      r.tokens[slot] = null;
      if (['waiting', 'voting', 'loadout', 'countdown'].includes(r.phase)) {
        r.phase = 'waiting';
        r.deadline = null;
        r.combat.forEach((p) => (p.ready = false));
        r.votes.fill(null);
      } else {
        r.combat[slot].health = 0;
        resolve(
          r,
          r.combat.map((p, i) => (i === slot ? 100 : p.health)),
          null,
        );
      }
    } else {
      r.disconnected[slot] = Date.now() + 30000;
      if (!r.pausedAt) {
        r.pausedAt = Date.now();
        r.combat.forEach(pauseCombat);
      }
    }
    broadcast(r);
    if (r.peers.every((p) => !p) && explicit) {
      rooms.delete(r.code);
      r.tokens.forEach((t) => tokens.delete(t));
    }
  }
  function handle(s, m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return false;
    if (['netAck', 'enableResume', 'resume'].includes(m?.type)) return false;
    if (m?.type === 'teamList') {
      send(s, { type: 'teamList', rooms: publicList() });
      return true;
    }
    if (m?.type === 'teamCreate') {
      if (!isTeamSize(m.size) || rooms.size >= 100) {
        send(s, { type: 'teamError', message: 'Choose 1v1 through 5v5.' });
        return true;
      }
      if (roomFor(s)) leave(s, true);
      let code;
      do {
        code = 'T' + randomBytes(3).toString('hex').slice(0, 5).toUpperCase();
      } while (rooms.has(code));
      const n = m.size * 2,
        r = {
          code,
          size: m.size,
          visibility: m.visibility === 'public' ? 'public' : 'private',
          peers: Array(n).fill(null),
          tokens: Array(n).fill(null),
          disconnected: Array(n).fill(null),
          names: Array.from({ length: n }, (_, i) => 'Player ' + (i + 1)),
          profiles: Array.from({ length: n }, defaultProfile),
          combat: Array.from({ length: n }, newCombatPlayer),
          kills: Array(n).fill(0),
          deaths: Array(n).fill(0),
          votes: Array(n).fill(null),
          mapId: mapsForTeams(m.size)[0],
          phase: 'waiting',
          deadline: null,
          pausedAt: null,
          scores: [0, 0],
          round: 0,
          winner: null,
          environment: null,
          lastKiller: Array(n).fill(null),
          recaps: Array(n).fill(null),
          replays: Array.from({ length: n }, createReplayBuffer),
          pairs: new Map(),
          lastBroadcast: 0,
        };
      r.environment = newEnvironment(r.mapId);
      rooms.set(code, r);
      join(r, s, 0);
      return true;
    }
    if (m?.type === 'teamJoin') {
      const r = rooms.get(String(m.code).trim().toUpperCase());
      if (!r) {
        send(s, { type: 'teamError', message: 'Team room not found.' });
        return true;
      }
      const slot = r.tokens.findIndex((t) => !t);
      if (slot < 0 || r.phase !== 'waiting') {
        send(s, {
          type: 'teamError',
          message: 'The room is full or already playing.',
        });
        return true;
      }
      if (roomFor(s)) leave(s, true);
      join(r, s, slot);
      return true;
    }
    if (m?.type === 'teamResume') {
      const entry = tokens.get(m.token),
        r = entry && rooms.get(entry.code);
      if (
        !r ||
        r.peers[entry.slot] ||
        r.disconnected[entry.slot] < Date.now()
      ) {
        send(s, {
          type: 'teamError',
          message: 'Reconnect expired. Join a room again.',
        });
        return true;
      }
      r.peers[entry.slot] = s;
      s.teamCode = r.code;
      r.disconnected[entry.slot] = null;
      if (r.peers.every(Boolean) && r.pausedAt) {
        const duration = Date.now() - r.pausedAt;
        r.pausedAt = null;
        if (r.deadline) r.deadline += duration;
        r.combat.forEach((p) => resumeCombat(p, duration, Date.now()));
      }
      if (r.phase === 'waiting' && r.peers.every(Boolean)) {
        r.phase = 'voting';
        r.deadline = Date.now() + 10000;
      }
      state(r, s);
      send(s, {
        type: 'teamSync',
        snapshot: combatSnapshot(r.combat[entry.slot]),
      });
      broadcast(r);
      return true;
    }
    const r = roomFor(s);
    if (!r) return false;
    const slot = r.peers.indexOf(s);
    if (slot < 0) return true;
    if (m.type === 'teamLeave') {
      leave(s, true);
      send(s, { type: 'teamLeft' });
      return true;
    }
    if (m.type === 'teamProfile') {
      const profile = readPlayerProfile(m.profile);
      if (profile) r.profiles[slot] = profile;
      broadcast(r);
      return true;
    }
    if (m.type === 'teamName') {
      if (
        !playerNameError(m.name) &&
        ['waiting', 'voting', 'loadout'].includes(r.phase)
      )
        r.names[slot] = m.name;
      broadcast(r);
      return true;
    }
    if (m.type === 'teamVote') {
      if (r.phase === 'voting' && mapsForTeams(r.size).includes(m.mapId)) {
        r.votes[slot] = m.mapId;
        if (r.votes.every(Boolean)) closeVote(r);
        else broadcast(r);
      }
      return true;
    }
    if (m.type === 'teamReady') {
      if (r.phase === 'loadout') {
        r.combat[slot].ready = true;
        r.combat[slot].loadout = readOnlineLoadout(m.loadout);
        if (r.combat.every((p) => p.ready)) {
          r.phase = 'countdown';
          r.deadline = Date.now() + 3000;
        }
        broadcast(r);
      }
      return true;
    }
    if (m.type === 'teamRematch') {
      if (r.phase === 'finished') {
        r.combat[slot].ready = true;
        if (r.combat.every((p) => p.ready)) {
          r.phase = 'voting';
          r.deadline = Date.now() + 10000;
          r.votes.fill(null);
          r.scores = [0, 0];
          r.kills.fill(0);
          r.deaths.fill(0);
          r.round = 0;
          r.combat.forEach((p) => (p.ready = false));
        }
        broadcast(r);
      }
      return true;
    }
    if (r.pausedAt || r.phase !== 'playing') return true;
    const player = r.combat[slot];
    if (m.type === 'move') {
      const p = m.pose;
      if (
        !p ||
        !['x', 'y', 'z', 'yaw', 'pitch'].every((k) => Number.isFinite(p[k])) ||
        Math.abs(p.x) > 100 ||
        Math.abs(p.z) > 100 ||
        p.y < -20 ||
        p.y > 100 ||
        Math.abs(p.pitch) > Math.PI ||
        player.health <= 0
      )
        return true;
      recordPose(player, p, Date.now());
      if (p.y < FALL_DEATH_Y) {
        const before = r.combat.map((p) => p.health);
        player.incomingDamage.record('fall', 'body', player.health, 0, 0);
        player.health = 0;
        r.lastKiller[slot] = slot;
        resolve(r, before, slot);
      }
      return true;
    }
    if (m.type === 'equip') {
      equipCombatWeapon(player, m.weapon);
      return true;
    }
    if (m.type === 'effect') {
      const effect = readOnlineEffect(m),
        target = r.combat.find(
          (p, i) => p.health > 0 && teamOf(i, r.size) !== teamOf(slot, r.size),
        );
      if (!effect || !target || player.health <= 0) return true;
      const before = r.combat.map((p) => p.health),
        world = worldFor(r, slot);
      if (
        !checkCombatEffect(
          player,
          target,
          effect,
          m.sequence,
          Date.now(),
          world,
          (kind, sequence) => send(s, { type: 'hit', kind, sequence }),
        )
      )
        return true;
      r.environment = world.environment.state;
      capturePairs(
        r,
        effect.action === 'fire'
          ? { actor: slot, origin: effect.origin, direction: effect.direction }
          : undefined,
      );
      resolve(r, before, slot);
      r.peers.forEach(
        (peer, i) =>
          peer &&
          i !== slot &&
          send(peer, { type: 'teamEffect', slot, effect }),
      );
      return true;
    }
    return true;
  }
  function join(r, s, slot) {
    r.peers[slot] = s;
    r.tokens[slot] = randomBytes(24).toString('hex');
    tokens.set(r.tokens[slot], { code: r.code, slot });
    s.teamCode = r.code;
    if (r.peers.every(Boolean)) {
      r.phase = 'voting';
      r.deadline = Date.now() + 10000;
    }
    broadcast(r);
  }
  function closeVote(r) {
    r.mapId = chooseVotedMap(r.size, r.votes, randomInt(100));
    r.environment = newEnvironment(r.mapId);
    r.phase = 'loadout';
    r.deadline = null;
    r.combat.forEach((p) => (p.ready = false));
    broadcast(r);
  }
  let previous = Date.now();
  const timer = setInterval(() => {
    const now = Date.now(),
      dt = Math.min(0.1, (now - previous) / 1000);
    previous = now;
    for (const r of rooms.values()) {
      if (r.pausedAt) {
        for (let i = 0; i < r.disconnected.length; i++)
          if (r.disconnected[i] && r.disconnected[i] < now) {
            r.disconnected[i] = null;
            tokens.delete(r.tokens[i]);
            r.tokens[i] = null;
            r.combat[i].health = 0;
          }
        if (r.peers.every((s) => !s) && r.disconnected.every((t) => !t)) {
          rooms.delete(r.code);
          continue;
        }
        if (r.disconnected.every((t) => !t)) {
          const elapsed = now - r.pausedAt;
          r.pausedAt = null;
          if (r.deadline) r.deadline += elapsed;
          r.combat.forEach((p) => resumeCombat(p, elapsed, now));
          if (['waiting', 'voting', 'loadout', 'countdown'].includes(r.phase)) {
            r.phase = 'waiting';
            r.deadline = null;
            r.combat.forEach((p) => {
              p.ready = false;
            });
            r.votes.fill(null);
            broadcast(r);
          } else if (r.phase !== 'finished')
            resolve(
              r,
              r.combat.map((p) => p.health),
              null,
            );
        }
        continue;
      }
      if (r.deadline && now >= r.deadline) {
        if (r.phase === 'voting') closeVote(r);
        else if (r.phase === 'countdown' || r.phase === 'intermission')
          resetRound(r);
      }
      if (r.phase === 'playing') {
        r.environment.seconds += dt;
        capturePairs(r);
        for (
          let actor = 0;
          actor < r.combat.length && r.phase === 'playing';
          actor++
        ) {
          const player = r.combat[actor],
            target = r.combat.find(
              (p, i) =>
                p.health > 0 && teamOf(i, r.size) !== teamOf(actor, r.size),
            );
          if (player.health <= 0 || !target) continue;
          const before = r.combat.map((p) => p.health),
            world = worldFor(r, actor);
          updateCombat(
            player,
            target,
            dt,
            now,
            world,
            (kind, sequence) =>
              r.peers[actor] &&
              send(r.peers[actor], { type: 'hit', kind, sequence }),
          );
          r.environment = world.environment.state;
          resolve(r, before, actor);
        }
      }
      if (now - r.lastBroadcast >= 100) {
        r.lastBroadcast = now;
        broadcast(r);
      }
    }
  }, 20);
  timer.unref();
  return {
    handle,
    disconnect: (s) => leave(s),
    close() {
      clearInterval(timer);
      worlds.forEach((w) => w.dispose());
    },
    rooms,
  };
}
