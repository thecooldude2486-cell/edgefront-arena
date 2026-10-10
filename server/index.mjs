import { createTeamRooms } from './teamRooms.mjs';
import { createReplayBuffer } from '../game/killReplay.ts';
import {
  newEnvironment,
  barrelDamage,
  FALL_DEATH_Y,
} from '../game/arenaEnvironment.ts';
import { Vector3 } from '@babylonjs/core';
import { DEFAULT_MAP, isArenaMapId } from '../game/maps.ts';
import { createServer } from 'node:http';
import { randomInt, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { WEAPON_DEFINITIONS } from '../game/weaponDefinitions.ts';
import { readOnlineEffect } from '../game/onlineEffects.ts';
import {
  createHitWorld,
  newCombatPlayer,
  checkCombatEffect,
  equipCombatWeapon,
  updateCombat,
  clearCombat,
} from './combat.mjs';
import { playerNameError } from '../game/playerName.ts';
import { readPlayerProfile, EMPTY_COSMETICS } from '../game/progression.ts';
import {
  newScore,
  awardElimination,
  WIN_SCORE,
  ROUND_PAUSE_MS,
} from './scoring.mjs';

import { readOnlineLoadout } from '../game/onlineSnapshot.ts';
import {
  RECONNECT_GRACE_MS,
  recordPose,
  compensatedPose,
  pauseCombat,
  resumeCombat,
  combatSnapshot,
} from './reliability.mjs';

// Room identity, all weapon combat and health are server-owned; movement is relayed.
export function createRoomServer({
  port = 3008,
  host = '127.0.0.1',
  origins = ['http://localhost:3000', 'http://127.0.0.1:3000'],
  reconnectGraceMs = RECONNECT_GRACE_MS,
} = {}) {
  const rooms = new Map(),
    sessions = new Map();
  let stopping = false;
  const worlds = new Map([[DEFAULT_MAP, createHitWorld()]]);
  function roomWorld(room, actor = null) {
    if (!worlds.has(room.mapId))
      worlds.set(room.mapId, createHitWorld(room.mapId));
    const world = worlds.get(room.mapId);
    world.setEnvironment(room.environment, (point) => {
      room.combat.forEach((player, index) => {
        if (!player.ready || !player.pose || player.health <= 0) return;
        const center = new Vector3(player.pose.x, player.pose.y, player.pose.z),
          distance = Vector3.Distance(point, center);
        const amount = barrelDamage(distance);
        if (!amount || !world.visible(point, center)) return;
        const before = player.health;
        player.health = Math.max(0, before - amount);
        player.incomingDamage.record(
          'oilBarrel',
          'splash',
          before,
          player.health,
          distance,
        );
        if (player.health === 0) player.hazardKiller = actor;
        if (actor !== null && actor !== index)
          room.combat[actor].performance.damage(
            before,
            player.health,
            false,
            distance,
            false,
          );
      });
    });
    return world;
  }
  function captureReplay(room, shot) {
    if (!room.combat.every((p) => p.pose)) return;
    room.replay.capture(
      Date.now(),
      room.combat.map((p) => ({
        pose: p.pose,
        health: p.health,
        weapon: p.weapon,
      })),
      shot,
      room.environment,
    );
  }
  const deathRecaps = (room) =>
    room.combat.map((player, index) => {
      if (player.health !== 0) return null;
      captureReplay(room);
      const cause = player.incomingDamage.read('', 0, 0).finalHit?.weapon;
      const killer =
        cause === 'fall'
          ? index
          : cause === 'oilBarrel' && Number.isInteger(player.hazardKiller)
            ? player.hazardKiller
            : 1 - index;
      const recap = player.incomingDamage.read(
        cause === 'fall'
          ? 'The void'
          : cause === 'oilBarrel'
            ? 'Oil barrel'
            : room.names[1 - index],
        room.combat[1 - index].health,
        player.performance.read(0, Date.now()).damageDealt,
      );
      return {
        ...recap,
        killerStats: room.combat[killer].performance.read(
          room.combat[killer].health,
          Date.now(),
        ),
        replay: room.replay.read(
          room.mapId,
          killer,
          room.environment.barrelHealth,
          room.environment.seconds,
        ),
        replayProfiles: room.profiles,
      };
    });
  function environmentMessage(room, socket = null) {
    const message = {
      type: 'environment',
      state: room.environment,
      running:
        !room.pausedSince &&
        room.match.phase === 'playing' &&
        room.combat.every((p) => p.ready),
      round: room.match.round,
      matchId: room.matchId,
    };
    if (socket) send(socket, message);
    else room.players.forEach((s) => s && send(s, message));
    room.lastEnvironmentAt = Date.now();
  }
  function resetEnvironment(room) {
    room.environment = newEnvironment(room.mapId);
    room.replay.reset();
  }
  function resolveHazards(room, world, before) {
    const old = room.environment.barrelHealth.join(',');
    room.environment = world.environment.state;
    if (old !== room.environment.barrelHealth.join(','))
      environmentMessage(room);
    if (room.combat.some((p, i) => p.health !== before[i])) health(room);
    if (room.combat.some((p) => p.health === 0)) {
      captureReplay(room);
      if (room.combat.every((p) => p.health === 0)) {
        if (room.match.phase !== 'playing') return;
        room.match.phase = 'roundOver';
        room.match.winner = null;
        room.combat.forEach(clearCombat);
        score(room);
        scheduleRound(room, ROUND_PAUSE_MS);
      } else finishRound(room, room.combat[0].health === 0 ? 1 : 0);
    }
  }
  const health = (room) =>
    room.players.forEach(
      (socket) =>
        socket &&
        send(socket, {
          type: 'health',
          players: room.combat.map((player) => ({
            health: player.health,
            eliminated: player.health === 0,
          })),
        }),
    );
  const http = createServer((req, res) => {
    if (req.url?.split('?')[0] === '/health') {
      res.writeHead(stopping ? 503 : 200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({
        service: 'edgefront-rooms',
        ready: !stopping,
        teamSizes: [1, 2, 3, 4, 5],
      }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Edgefront room server');
  });
  const wss = new WebSocketServer({
    server: http,
    maxPayload: 1024,
    verifyClient: ({ origin }) => origins.includes(origin),
  });
  const send = (socket, message) => {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  };
  const teamRooms = createTeamRooms(send);
  const score = (room) => {
    const now = Date.now(),
      performances = room.combat.map((player) =>
        player.performance.read(player.health, now),
      );
    const message = {
      type: 'score',
      recaps: deathRecaps(room),
      ...room.match,
      matchId: room.matchId,
      target: WIN_SCORE,
      performances,
    };
    room.players.forEach((socket) => socket && send(socket, message));
  };
  function finishRound(room, shooter) {
    if (!awardElimination(room.match, shooter)) return;
    room.combat.forEach(clearCombat);
    score(room);
    environmentMessage(room);
    if (room.match.phase === 'finished') return;
    scheduleRound(room, ROUND_PAUSE_MS);
  }
  function scheduleRound(room, delay) {
    room.roundDueAt = Date.now() + delay;
    room.roundTimer = setTimeout(() => {
      room.roundTimer = null;
      room.roundDueAt = null;
      if (
        rooms.get(room.code) !== room ||
        room.pausedSince ||
        !room.players.every(Boolean)
      )
        return;
      room.combat = room.combat.map((previous) => ({
        ...newCombatPlayer(),
        sequence: previous.sequence,
        loadout: previous.loadout,
      }));
      resetEnvironment(room);
      room.match.round++;
      room.match.phase = 'playing';
      room.match.winner = null;
      environmentMessage(room);
      health(room);
      score(room);
    }, delay);
  }
  function scheduleRematch(room, delay) {
    room.startsAt = Date.now() + delay;
    room.rematchTimer = setTimeout(() => {
      room.rematchTimer = null;
      room.startsAt = null;
      room.loadoutReady = null;
      room.rematching = false;
      if (
        rooms.get(room.code) !== room ||
        room.pausedSince ||
        !room.players.every(Boolean)
      )
        return;
      room.players.forEach((socket) =>
        send(socket, { type: 'matchStart', matchId: room.matchId }),
      );
    }, delay);
  }
  const occupied = (room) =>
    room.players.map((socket, index) => !!socket || !!room.reservations[index]);
  function bindSession(socket, room, index) {
    const session = sessions.get(socket.resumeToken);
    if (session) {
      session.roomCode = room.code;
      session.index = index;
      session.socket = socket;
    }
  }
  function sync(room, socket) {
    const index = room.players.indexOf(socket);
    if (index < 0) return;
    environmentMessage(room, socket);
    send(socket, {
      type: 'sync',
      recaps: deathRecaps(room),
      matchId: room.matchId,
      match: room.match,
      players: room.combat.map((player) => combatSnapshot(player)),
      named: room.named,
      loadoutReady: room.loadoutReady,
      remainingMs: room.startsAt
        ? Math.max(0, room.startsAt - Date.now())
        : null,
      rematching: !!room.rematching,
    });
  }
  function pause(room) {
    if (room.pausedSince) return;
    room.pausedSince = Date.now();
    room.roundRemaining = room.roundDueAt
      ? Math.max(1, room.roundDueAt - Date.now())
      : null;
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
    room.startRemaining =
      room.startsAt > Date.now()
        ? Math.max(1, room.startsAt - Date.now())
        : null;
    clearTimeout(room.rematchTimer);
    room.rematchTimer = null;
    room.combat.forEach(pauseCombat);
    environmentMessage(room);
  }
  function unpause(room) {
    if (!room.pausedSince || !room.players.every(Boolean)) return;
    const now = Date.now(),
      duration = now - room.pausedSince;
    room.pausedSince = null;
    room.combat.forEach((player) => resumeCombat(player, duration, now));
    environmentMessage(room);
    if (room.roundRemaining !== null) {
      scheduleRound(room, room.roundRemaining);
      room.roundRemaining = null;
    }
    if (room.startRemaining !== null) {
      if (room.rematching) scheduleRematch(room, room.startRemaining);
      else {
        room.startsAt = now + room.startRemaining;
        room.players.forEach((socket) =>
          send(socket, {
            type: 'loadoutCountdown',
            remainingMs: room.startRemaining,
          }),
        );
      }
      room.startRemaining = null;
    }
  }

  function publicRooms() {
    // Never include private room codes or combat state in discovery messages.
    return [...rooms.values()]
      .filter((room) => room.visibility === 'public')
      .map((room) => ({
        mapId: room.mapId,
        code: room.code,
        players: occupied(room).filter(Boolean).length,
      }));
  }
  function publishRooms() {
    const message = { type: 'rooms', rooms: publicRooms() };
    wss.clients.forEach((socket) => {
      if (socket.wantsRooms) send(socket, message);
    });
  }
  function broadcast(room) {
    room.players.forEach((socket, index) => {
      if (socket)
        send(socket, {
          type: 'room',
          mapId: room.mapId,
          code: room.code,
          player: index + 1,
          players: room.players.map(Boolean),
          ready: occupied(room).every(Boolean),
          paused: !!room.pausedSince,
          reconnectUntil: Math.max(
            0,
            ...room.reservations.map(
              (token) => sessions.get(token)?.expiresAt ?? 0,
            ),
          ),
          matchId: room.matchId,
          rematchReady: room.rematchReady,
          rematching: !!room.rematching,
          visibility: room.visibility,
          names: room.names,
          profiles: room.profiles,
        });
    });
    publishRooms();
  }
  function removeSeat(room, index) {
    clearTimeout(room.roundTimer);
    clearTimeout(room.rematchTimer);
    room.roundTimer = null;
    room.rematchTimer = null;
    room.roundDueAt = null;
    room.roundRemaining = null;
    room.startRemaining = null;
    room.rematching = false;
    room.combat.forEach(clearCombat);
    if (room.players[index]) room.players[index].roomCode = null;
    const reserved = room.reservations[index],
      session = sessions.get(reserved);
    if (session) {
      clearTimeout(session.timer);
      sessions.delete(reserved);
    }
    room.reservations[index] = null;
    for (const [token, record] of sessions)
      if (
        record.roomCode === room.code &&
        (index === 0 || record.index === index)
      ) {
        clearTimeout(record.timer);
        if (!record.socket) sessions.delete(token);
        else {
          record.roomCode = null;
          record.index = null;
        }
      }
    if (index === 0) {
      rooms.delete(room.code);
      publishRooms();
      if (room.players[1]) {
        room.players[1].roomCode = null;
        send(room.players[1], {
          type: 'closed',
          message: 'Player 1 left. Room closed.',
        });
      }
    } else {
      room.players[1] = null;
      room.pausedSince = null;
      room.loadoutReady = [false, false];
      room.startsAt = null;
      room.named[1] = false;
      room.rematchReady = [false, false];
      room.combat.forEach((player) => {
        player.ready = false;
      });
      broadcast(room);
    }
  }
  function leave(socket) {
    const room = rooms.get(socket.roomCode),
      index = room?.players.indexOf(socket);
    socket.roomCode = null;
    if (room && index >= 0) removeSeat(room, index);
  }
  function disconnected(socket) {
    if (stopping) return;
    const record = sessions.get(socket.resumeToken),
      room = rooms.get(socket.roomCode),
      index = room?.players.indexOf(socket);
    if (!record || !room || index < 0) {
      leave(socket);
      if (record) sessions.delete(socket.resumeToken);
      return;
    }
    record.socket = null;
    record.expiresAt = Date.now() + reconnectGraceMs;
    room.players[index] = null;
    room.reservations[index] = socket.resumeToken;
    socket.roomCode = null;
    pause(room);
    broadcast(room);
    record.timer = setTimeout(() => {
      if (sessions.get(socket.resumeToken) !== record || record.socket) return;
      if (rooms.get(room.code) !== room) {
        sessions.delete(socket.resumeToken);
        return;
      }
      removeSeat(room, index);
    }, reconnectGraceMs);
  }
  wss.on('connection', (socket) => {
    socket.alive = true;
    socket.roomCode = null;
    socket.lastRequest = 0;
    socket.lastMovement = 0;
    socket.on('pong', () => {
      socket.alive = true;
    });
    socket.on('error', () => socket.close());
    socket.on('close', () => {
      teamRooms.disconnect(socket);
      disconnected(socket);
    });
    socket.on('message', (bytes, binary) => {
      const error = (message) => send(socket, { type: 'error', message });
      if (binary) return error('Use JSON text messages.');
      let message;
      try {
        message = JSON.parse(bytes.toString());
      } catch {
        return error('Invalid message.');
      }
      if (teamRooms.handle(socket, message)) return;
      if (message?.type === 'enableResume') {
        if (!socket.resumeToken) {
          socket.resumeToken = randomBytes(24).toString('hex');
          sessions.set(socket.resumeToken, {
            socket,
            roomCode: null,
            index: null,
          });
        }
        const room = rooms.get(socket.roomCode);
        if (room) bindSession(socket, room, room.players.indexOf(socket));
        send(socket, { type: 'session', token: socket.resumeToken });
        return;
      }
      if (message?.type === 'resume') {
        const token = typeof message.token === 'string' ? message.token : '',
          record = sessions.get(token);
        if (
          socket.roomCode ||
          socket.resumeToken ||
          !record ||
          (record.socket && record.socket.readyState === WebSocket.OPEN) ||
          (record.expiresAt && record.expiresAt < Date.now())
        ) {
          send(socket, {
            type: 'resumeRejected',
            retryable:
              !!record?.socket && record.socket.readyState === WebSocket.OPEN,
            message: 'The previous session could not be restored.',
          });
          return;
        }
        const room = rooms.get(record.roomCode);
        if (!room) {
          sessions.delete(token);
          send(socket, {
            type: 'resumeRejected',
            message: 'The previous room has closed.',
          });
          return;
        }
        const index = record.index;
        if (room.reservations[index] !== token || room.players[index]) {
          send(socket, {
            type: 'resumeRejected',
            message: 'That player is already connected.',
          });
          return;
        }
        clearTimeout(record.timer);
        record.socket = socket;
        record.expiresAt = null;
        socket.resumeToken = token;
        socket.roomCode = room.code;
        room.players[index] = socket;
        room.reservations[index] = null;
        send(socket, { type: 'session', token, resumed: true });
        unpause(room);
        broadcast(room);
        room.players.forEach((player) => player && sync(room, player));
        health(room);
        score(room);
        return;
      }
      if (message?.type === 'netAck') {
        if (
          !socket.probe ||
          !Number.isSafeInteger(message.id) ||
          message.id !== socket.probe.id
        )
          return;
        const now = Date.now(),
          sample = Math.max(0, now - socket.probe.at);
        socket.probe = null;
        socket.netSamples = [
          ...(socket.netSamples ?? []),
          Math.min(2000, sample),
        ].slice(-5);
        socket.rttMs = Math.min(...socket.netSamples);
        socket.lastNetAck = now;
        send(socket, { type: 'netStats', rttMs: socket.rttMs });
        return;
      }
      if (message?.type === 'leave') {
        leave(socket);
        send(socket, { type: 'left' });
        return;
      }
      if (message?.type === 'rematch') {
        const room = rooms.get(socket.roomCode);
        if (
          !room ||
          room.pausedSince ||
          !room.players.every(Boolean) ||
          room.match.phase !== 'finished'
        )
          return;
        room.rematchReady[room.players.indexOf(socket)] = true;
        if (room.rematchReady.every(Boolean)) {
          room.matchId++;
          room.match = newScore();
          room.rematchReady = [false, false];
          room.rematching = true;
          room.combat = room.combat.map((previous) => ({
            ...newCombatPlayer(),
            sequence: previous.sequence,
            loadout: previous.loadout,
          }));
          resetEnvironment(room);
          environmentMessage(room);
          room.loadoutReady = [true, true];
          scheduleRematch(room, 3000);
          broadcast(room);
          health(room);
          score(room);
          room.players.forEach((player) =>
            send(player, {
              type: 'rematchStart',
              remainingMs: 3000,
              matchId: room.matchId,
            }),
          );
        } else broadcast(room);
        return;
      }
      const activeRoom = rooms.get(socket.roomCode);
      if (
        activeRoom?.pausedSince &&
        [
          'loadoutReady',
          'combatReady',
          'move',
          'equip',
          'effect',
          'shot',
          'grenade',
        ].includes(message?.type)
      )
        return;
      if (message?.type === 'loadoutReady') {
        const room = rooms.get(socket.roomCode);
        if (!room || !room.players.every(Boolean)) return;
        room.loadoutReady ??= [false, false];
        room.loadoutReady[room.players.indexOf(socket)] = true;
        if (room.loadoutReady.every(Boolean) && !room.startsAt) {
          room.startsAt = Date.now() + 10000;
          room.players.forEach((player) =>
            send(player, { type: 'loadoutCountdown', remainingMs: 10000 }),
          );
        }
        return;
      }
      // No movement or combat packets during the shared ready/countdown phase.
      const pendingRoom = rooms.get(socket.roomCode);
      if (
        pendingRoom?.loadoutReady &&
        (!pendingRoom.startsAt || Date.now() < pendingRoom.startsAt) &&
        ['combatReady', 'move', 'effect', 'shot', 'grenade'].includes(
          message?.type,
        )
      )
        return;
      if (message?.type === 'profile') {
        const room = rooms.get(socket.roomCode);
        if (!room || Date.now() - (socket.lastProfile || 0) < 100) return;
        const profile = readPlayerProfile(message.profile);
        if (!profile) return;
        socket.lastProfile = Date.now();
        // Progress is device-local. Only sanitized presentation data is relayed;
        // profiles have no authority over combat, scores, health or equipment.
        room.profiles[room.players.indexOf(socket)] = profile;
        broadcast(room);
        return;
      }
      if (message?.type === 'setName') {
        const room = rooms.get(socket.roomCode);
        if (!room) return error('Join a room first.');
        const index = room.players.indexOf(socket);
        if (room.combat[index].ready)
          return error('Your name is locked during this match.');
        if (Date.now() - (socket.lastName || 0) < 200)
          return error('Please wait a moment.');
        socket.lastName = Date.now();
        const invalid = playerNameError(message.name);
        if (invalid) return error(invalid);
        room.names[index] = message.name;
        room.named[index] = true;
        send(socket, { type: 'nameAccepted', name: message.name });
        broadcast(room);
        return;
      }
      if (message?.type === 'listRooms') {
        if (Date.now() - (socket.lastList || 0) < 500) return;
        socket.lastList = Date.now();
        socket.wantsRooms = true;
        send(socket, { type: 'rooms', rooms: publicRooms() });
        return;
      }
      if (message?.type === 'combatReady') {
        const room = rooms.get(socket.roomCode);
        if (!room || !room.players.every(Boolean)) return;
        const state = room.combat[room.players.indexOf(socket)],
          newlyReady = !state.ready;
        const loadout = readOnlineLoadout(message.loadout);
        if (loadout) state.loadout = loadout;
        state.ready = true;
        if (newlyReady && room.combat.every((player) => player.ready))
          room.combat.forEach((player) => player.performance.reset(Date.now()));
        environmentMessage(room);
        health(room);
        score(room);
        return;
      }
      if (message?.type === 'effect') {
        const room = rooms.get(socket.roomCode),
          effect = readOnlineEffect(message);
        if (
          !room ||
          room.match.phase !== 'playing' ||
          !room.players.every(Boolean) ||
          !effect
        )
          return;
        const actor = room.players.indexOf(socket);
        const shooter = room.combat[actor],
          target = room.combat[1 - actor];
        const before = room.combat.map((p) => p.health),
          world = roomWorld(room, actor);
        if (
          !checkCombatEffect(
            shooter,
            target,
            effect,
            message.sequence,
            Date.now(),
            world,
            (kind, sequence) => send(socket, { type: 'hit', kind, sequence }),
            compensatedPose(target, socket, Date.now()),
          )
        )
          return;
        if (effect.action === 'fire')
          captureReplay(room, {
            actor,
            origin: effect.origin,
            direction: effect.direction,
          });
        resolveHazards(room, world, before);
        const player = room.players.indexOf(socket);
        send(room.players[1 - player], {
          type: 'effect',
          player: player + 1,
          ...effect,
        });
        return;
      }
      // Legacy visual packets cannot bypass equipped-weapon, ammo or hit checks.
      if (message?.type === 'grenade' || message?.type === 'shot') return;
      if (message?.type === 'equip') {
        const room = rooms.get(socket.roomCode);
        if (!room || !room.players.every(Boolean)) return;
        if (
          typeof message.weapon !== 'string' ||
          !Object.hasOwn(WEAPON_DEFINITIONS, message.weapon)
        )
          return;
        // Relay only the weapon ID, never client identity, ammo or combat data.
        const player = room.players.indexOf(socket);
        const state = room.combat[player];
        if (state.health <= 0) return;
        equipCombatWeapon(state, message.weapon);
        send(room.players[1 - player], {
          type: 'equip',
          player: player + 1,
          weapon: message.weapon,
        });
        return;
      }
      if (message?.type === 'move') {
        const room = rooms.get(socket.roomCode),
          pose = message.pose;
        if (room && room.match.phase !== 'playing') return;
        if (!room || !room.players.every(Boolean)) return;
        if (
          !pose ||
          !['x', 'y', 'z', 'yaw', 'pitch'].every(
            (key) =>
              typeof pose[key] === 'number' && Number.isFinite(pose[key]),
          )
        )
          return;
        if (
          Math.abs(pose.x) > 100 ||
          Math.abs(pose.z) > 100 ||
          pose.y < -20 ||
          pose.y > 100 ||
          Math.abs(pose.yaw) > 100000 ||
          Math.abs(pose.pitch) > Math.PI
        )
          return;
        const player = room.players.indexOf(socket);
        if (room.combat[player].health <= 0) return;
        recordPose(
          room.combat[player],
          { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, pitch: pose.pitch },
          Date.now(),
        );
        if (
          room.combat[player].ready &&
          room.combat.every((p) => p.ready) &&
          pose.y < FALL_DEATH_Y
        ) {
          const state = room.combat[player],
            before = state.health;
          state.health = 0;
          state.incomingDamage.record('fall', 'body', before, 0, 0);
          captureReplay(room);
          health(room);
          finishRound(room, 1 - player);
          return;
        }
        if (Date.now() - socket.lastMovement < 40) return;
        socket.lastMovement = Date.now();
        send(room.players[1 - player], {
          type: 'move',
          player: player + 1,
          pose: {
            x: pose.x,
            y: pose.y,
            z: pose.z,
            yaw: pose.yaw,
            pitch: pose.pitch,
          },
        });
        return;
      }
      if (Date.now() - socket.lastRequest < 150)
        return error('Please wait a moment.');
      socket.lastRequest = Date.now();
      if (!message || !['create', 'join', 'leave'].includes(message.type))
        return error('Unknown room action.');
      if (message.type === 'leave') {
        leave(socket);
        send(socket, { type: 'left' });
        return;
      }
      if (socket.roomCode) return error('Leave your current room first.');
      if (message.type === 'create') {
        if (
          message.visibility !== undefined &&
          !['public', 'private'].includes(message.visibility)
        )
          return error('Choose Public or Private.');
        if (message.mapId !== undefined && !isArenaMapId(message.mapId))
          return error('Choose a valid arena map.');
        if (rooms.size >= 100) return error('Server is busy. Try again later.');
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code;
        do {
          code = Array.from(
            { length: 6 },
            () => alphabet[randomInt(alphabet.length)],
          ).join('');
        } while (rooms.has(code));
        const room = {
          mapId: message.mapId ?? DEFAULT_MAP,
          code,
          visibility: message.visibility ?? 'private',
          names: ['Player1', 'Player2'],
          profiles: [
            { level: 1, cosmetics: { ...EMPTY_COSMETICS } },
            { level: 1, cosmetics: { ...EMPTY_COSMETICS } },
          ],
          players: [socket, null],
          reservations: [null, null],
          named: [false, false],
          matchId: 1,
          rematchReady: [false, false],
          pausedSince: null,
          environment: newEnvironment(message.mapId ?? DEFAULT_MAP),
          replay: createReplayBuffer(),
          combat: [newCombatPlayer(), newCombatPlayer()],
          match: newScore(),
        };
        rooms.set(code, room);
        socket.roomCode = code;
        bindSession(socket, room, 0);
        broadcast(room);
      } else {
        const code =
          typeof message.code === 'string'
            ? message.code.trim().toUpperCase()
            : '';
        if (!/^[A-Z2-9]{6}$/.test(code))
          return error('Enter a six-character room code.');
        const room = rooms.get(code);
        if (!room) return error('Room not found.');
        if (occupied(room)[1])
          return error('Room is full (2 players maximum).');
        resetEnvironment(room);
        room.combat = [newCombatPlayer(), newCombatPlayer()];
        room.match = newScore();
        room.pausedSince = null;
        room.roundRemaining = null;
        room.startRemaining = null;
        room.rematching = false;
        room.startsAt = null;
        room.loadoutReady = null;
        room.names[1] = 'Player2';
        room.profiles[1] = { level: 1, cosmetics: { ...EMPTY_COSMETICS } };
        room.players[1] = socket;
        socket.roomCode = code;
        room.named[1] = false;
        room.matchId++;
        room.rematchReady = [false, false];
        bindSession(socket, room, 1);
        broadcast(room);
      }
    });
  });
  const heartbeat = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (!socket.alive) return socket.terminate();
      socket.alive = false;
      socket.ping();
    });
  }, 15000);
  heartbeat.unref();
  let probeId = 0;
  function probe(socket) {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.probe) {
      // A half-open connection may never emit close. End it before its player
      // can spend the whole reconnect window waiting for a TCP timeout.
      if (Date.now() - socket.probe.at >= 10000) socket.terminate();
      return;
    }
    socket.probe = { id: ++probeId, at: Date.now() };
    send(socket, { type: 'netProbe', id: socket.probe.id });
  }
  // Probe only clients that opted into the new protocol; legacy rooms remain compatible.
  const probeTimer = setInterval(
    () =>
      wss.clients.forEach((socket) => {
        if (socket.resumeToken) probe(socket);
      }),
    2000,
  );
  probeTimer.unref();
  let previousTick = Date.now();
  const combatTimer = setInterval(() => {
    const now = Date.now(),
      seconds = Math.min(0.25, Math.max(0, now - previousTick) / 1000);
    previousTick = now;
    for (const room of rooms.values()) {
      if (
        room.pausedSince ||
        room.match.phase !== 'playing' ||
        !room.players.every(Boolean)
      )
        continue;
      if (room.combat.every((p) => p.ready)) {
        room.environment.seconds += seconds;
        captureReplay(room);
        if (now - (room.lastEnvironmentAt || 0) > 400) environmentMessage(room);
      }
      for (
        let actor = 0;
        actor < 2 && room.match.phase === 'playing';
        actor++
      ) {
        const shooter = room.combat[actor],
          target = room.combat[1 - actor],
          before = room.combat.map((p) => p.health),
          world = roomWorld(room, actor);
        updateCombat(shooter, target, seconds, now, world, (kind, sequence) =>
          send(room.players[actor], { type: 'hit', kind, sequence }),
        );
        resolveHazards(room, world, before);
      }
    }
  }, 20);
  combatTimer.unref();
  http.listen(port, host);
  return {
    http,
    close: () =>
      new Promise((resolve) => {
        stopping = true;
        clearInterval(heartbeat);
        clearInterval(probeTimer);
        clearInterval(combatTimer);
        teamRooms.close();
        sessions.forEach((record) => clearTimeout(record.timer));
        wss.clients.forEach((socket) => socket.terminate());
        rooms.forEach((room) => {
          clearTimeout(room.roundTimer);
          clearTimeout(room.rematchTimer);
        });
        worlds.forEach((world) => world.dispose());
        wss.close(() => http.close(resolve));
      }),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.PORT || 3008);
  createRoomServer({
    port,
    host: process.env.HOST || '127.0.0.1',
    origins: (
      process.env.ALLOWED_ORIGINS ||
      'http://localhost:3000,http://127.0.0.1:3000'
    ).split(','),
  });
  console.log('Edgefront rooms listening on port ' + port);
}
