'use client';
import {
  readEnvironment,
  type EnvironmentState,
} from '@/game/arenaEnvironment';

import { MapPicker } from './MapPicker';
import {
  ARENA_MAPS,
  DEFAULT_MAP,
  isArenaMapId,
  type ArenaMapId,
} from '@/game/maps';
import { readDeathRecap, type DeathRecap as Recap } from '@/game/deathRecap';
import { DeathRecap, DeathRecapDialog } from './DeathRecap';
import { useEffect, useRef, useState } from 'react';
import './OnlineRooms.css';
import {
  createRoomConnection,
  type ConnectionStatus,
} from '@/game/createRoomConnection';
import {
  readCombatSnapshot,
  type OnlineCombatSnapshot,
} from '@/game/onlineSnapshot';
import { MOVEMENT_SEND_MS, type OnlineGame } from '@/game/onlineMovement';
import { WEAPON_DEFINITIONS, type WeaponId } from '@/game/weaponDefinitions';
import { readOnlineEffect } from '@/game/onlineEffects';
import { LoadoutSelection, type LoadoutChoices } from './LoadoutSelection';
import { AimOverlay } from './AimOverlay';
import { NameSelection } from './NameSelection';
import {
  createMatchXpTracker,
  readPlayerProfile,
  type Cosmetics,
  EMPTY_COSMETICS,
} from '@/game/progression';
import {
  LevelBadge,
  ProgressionBar,
  type ProgressionState,
} from './Progression';
import { playerNameError } from '@/game/playerName';
import {
  DEFAULT_CHARACTER,
  type CharacterAppearance,
} from '@/game/storeCatalog';

type Room = {
  code: string;
  mapId?: ArenaMapId;
  player: number;
  players: boolean[];
  ready: boolean;
  visibility: 'public' | 'private';
  paused?: boolean;
  rematching?: boolean;
  reconnectUntil?: number;
  matchId?: number;
  rematchReady?: boolean[];
  names?: string[];
  profiles?: {
    level: number;
    cosmetics: Cosmetics;
    character?: CharacterAppearance;
  }[];
};
type PublicRoom = { code: string; players: number; mapId?: ArenaMapId };
export function OnlineRooms({
  onBack,
  game,
  paused,
  ammo,
  loadout,
  onNameChange,
  career,
  onXp,
  onOpenCareer,
  character,
}: {
  character: CharacterAppearance;
  onOpenCareer: () => void;
  career: ProgressionState;
  onXp: (amount: number, bonuses?: string[]) => void;
  onBack: () => void;
  game: OnlineGame | null;
  paused: boolean;
  loadout: LoadoutChoices;
  onNameChange: (name: string) => void;
  ammo: {
    ammo: number;
    reserveAmmo: number;
    reloading: boolean;
    fireMode: string;
    scoped: boolean;
  };
}) {
  const xpCallbackRef = useRef(onXp);
  useEffect(() => {
    xpCallbackRef.current = onXp;
  }, [onXp]);
  const matchXp = useRef(createMatchXpTracker());
  const matchIdentity = useRef<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const connection = useRef<ReturnType<typeof createRoomConnection> | null>(
    null,
  );
  const [network, setNetwork] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
    attempt: 0,
    rttMs: null,
  });
  const [mapId, setMapId] = useState<ArenaMapId>(DEFAULT_MAP);
  const [lastRecap, setLastRecap] = useState<Recap | null>(null);
  const pendingEnvironment = useRef<{
    state: EnvironmentState;
    running: boolean;
  } | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [rematchStarting, setRematchStarting] = useState(false);
  const [restoreReady, setRestoreReady] = useState(false);
  const cosmeticsRef = useRef(career.cosmetics);
  useEffect(() => {
    cosmeticsRef.current = career.cosmetics;
  }, [career.cosmetics]);
  const pendingSnapshot = useRef<OnlineCombatSnapshot | null>(null);
  const restoredFromRefresh = useRef(false);
  const loadoutRef = useRef(loadout);
  useEffect(() => {
    loadoutRef.current = loadout;
  }, [loadout]);
  const remoteWeaponRef = useRef<WeaponId | null>(null);
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [publicRooms, setPublicRooms] = useState<PublicRoom[] | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState('');
  const [equipped, setEquipped] = useState<WeaponId>('assaultRifle');
  const [remoteWeapon, setRemoteWeapon] = useState<WeaponId | null>(null);
  const [selectionDone, setSelectionDone] = useState(false);
  const selectionRef = useRef(false);
  useEffect(() => {
    selectionRef.current = selectionDone;
  }, [selectionDone]);
  const [match, setMatch] = useState({
    scores: [0, 0],
    round: 1,
    phase: 'playing',
    winner: null as number | null,
  });
  const roundRef = useRef(1);
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [namePending, setNamePending] = useState(false);
  const [hitMarker, setHitMarker] = useState<{
    kind: 'body' | 'head' | 'direct';
    sequence: number;
  } | null>(null);
  const [health, setHealth] = useState([100, 100]);
  const healthRef = useRef([100, 100]);
  const shotSequence = useRef(0);
  useEffect(() => {
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const url =
      import.meta.env.VITE_MULTIPLAYER_URL ||
      (local ? 'ws://localhost:3008' : '');
    if (!url) {
      setError(
        'Online rooms are not configured on this website yet. Player vs Bot is still available.',
      );
      return;
    }
    if (location.protocol === 'https:' && !url.startsWith('wss://')) {
      setError('The live website needs a secure wss:// room server.');
      return;
    }
    let storage: Storage | undefined;
    try {
      storage = window.sessionStorage;
    } catch {
      /* Live reconnect remains available. */
    }
    const transport = createRoomConnection({
      url,
      storage,
      onStatus: (status) => {
        setNetwork(status);
        setConnected(status.connected);
        if (!status.connected) {
          setPending(false);
          setNamePending(false);
        }
        if (!status.connected) game?.setOnlineNetworkPaused(true);
      },
      onMessage: (message) => {
        if (message.type === 'environment') {
          const state = readEnvironment(message.state);
          if (!state) return;
          pendingEnvironment.current = {
            state,
            running: message.running === true,
          };
          game?.setOnlineEnvironment(state, message.running === true);
          return;
        }
        if (message.type === 'session') {
          if (message.resumed) restoredFromRefresh.current = !roomRef.current;
          return;
        }
        if (message.type === 'resumeRejected') {
          roomRef.current = null;
          setRoom(null);
          setSelectionDone(false);
          setError(message.message + ' Join or create a room to continue.');
          return;
        }
        if (message.type === 'sync' && roomRef.current) {
          if (!Array.isArray(message.players) || message.players.length !== 2)
            return;
          const snapshots = message.players.map(readCombatSnapshot);
          if (snapshots.some((value) => !value)) return;
          const recap = readDeathRecap(
            message.recaps?.[roomRef.current.player - 1],
          );
          if (recap) setLastRecap(recap);
          const index = roomRef.current.player - 1,
            own = snapshots[index]!;
          if (restoredFromRefresh.current) {
            const scores = message.match?.scores;
            if (Array.isArray(scores) && scores.length === 2) {
              matchXp.current.begin([scores[index], scores[1 - index]]);
              if (message.match.phase === 'finished') matchXp.current.stop();
            }
            restoredFromRefresh.current = false;
          }
          shotSequence.current = Math.max(shotSequence.current, own.sequence);
          setNameConfirmed(message.named?.[index] === true || own.ready);
          setRestoreReady(message.loadoutReady?.[index] === true);
          setStartsAt(
            typeof message.remainingMs === 'number' &&
              Number.isFinite(message.remainingMs)
              ? Date.now() + Math.max(0, message.remainingMs)
              : null,
          );
          setRematchStarting(message.rematching === true);
          if (own.ready || message.rematching) {
            setNameConfirmed(true);
            setSelectionDone(true);
          }
          pendingSnapshot.current = selectionRef.current ? null : own;
          if (own.loadout)
            own.loadout.forEach((id) => loadoutRef.current.choose(id));
          if (own.ready || message.rematching)
            loadoutRef.current.choose(own.weapon);
          setEquipped(own.weapon);
          const restoredName = roomRef.current.names?.[index];
          if (restoredName && !playerNameError(restoredName))
            onNameChange(restoredName);
          game?.restoreOnlineCombat(own);
          const values = snapshots.map((snapshot) => snapshot!.health);
          healthRef.current = values;
          setHealth(values);
          game?.setOnlineHealth(values[index], values[1 - index]);
          if (snapshots[1 - index]!.pose)
            game?.receiveOnlinePose(snapshots[1 - index]!.pose!);
          remoteWeaponRef.current = snapshots[1 - index]!.weapon;
          game?.receiveOnlineWeapon(remoteWeaponRef.current);
          return;
        }
        if (message.type === 'rematchStart' && roomRef.current) {
          setStartsAt(Date.now() + Math.max(0, message.remainingMs));
          setRematchStarting(true);
          setHitMarker(null);
          game?.setPreMatchLocked(true);
          return;
        }
        if (message.type === 'matchStart' && roomRef.current) {
          setRematchStarting(false);
          setStartsAt(null);
          game?.setPreMatchLocked(false);
          game?.setOnlineNetworkPaused(false);
          connection.current?.send({
            type: 'combatReady',
            loadout: game?.onlineLoadout(),
          });
          if (game)
            connection.current?.send({
              type: 'equip',
              weapon: game.readOnlineWeapon(),
            });
          return;
        }
        if (message.type === 'score' && roomRef.current?.ready) {
          if (
            !Array.isArray(message.scores) ||
            message.scores.length !== 2 ||
            !message.scores.every(
              (value: number) =>
                Number.isInteger(value) && value >= 0 && value <= 5,
            ) ||
            !Number.isInteger(message.round) ||
            !['playing', 'roundOver', 'finished'].includes(message.phase)
          )
            return;
          const player = roomRef.current.player;
          const recap = readDeathRecap(message.recaps?.[player - 1]);
          if (recap) setLastRecap(recap);
          xpCallbackRef.current(
            matchXp.current.update(
              [message.scores[player - 1], message.scores[2 - player]],
              message.phase === 'finished'
                ? message.winner === player
                  ? 'victory'
                  : 'defeat'
                : 'none',
              'online',
              message.performances?.[player - 1],
            ),
            matchXp.current.bonuses,
          );
          setMatch({
            scores: message.scores,
            round: message.round,
            phase: message.phase,
            winner: message.winner,
          });
          if (message.phase !== 'playing') {
            game?.setPreMatchLocked(true);
          } else if (message.round > roundRef.current) {
            roundRef.current = message.round;
            setHitMarker(null);
            game?.setPreMatchLocked(false);
            game?.enterOnline(roomRef.current.player);
            if (pendingEnvironment.current)
              game?.setOnlineEnvironment(
                pendingEnvironment.current.state,
                pendingEnvironment.current.running,
              );
            game?.receiveOnlineCosmetics(
              roomRef.current.profiles?.[2 - roomRef.current.player]
                ?.cosmetics ?? EMPTY_COSMETICS,
            );
            game?.receiveOnlineCharacter(
              roomRef.current?.profiles?.[2 - roomRef.current.player]
                ?.character ?? DEFAULT_CHARACTER,
            );
            game?.setOnlineHealth(100, 100);
            if (remoteWeaponRef.current)
              game?.receiveOnlineWeapon(remoteWeaponRef.current);
            connection.current?.send({
              type: 'combatReady',
              loadout: game?.onlineLoadout(),
            });
            // Each new round starts with the locally selected primary and fresh ammo.
            if (game)
              connection.current?.send({
                type: 'equip',
                weapon: game.readOnlineWeapon(),
              });
          }
          return;
        }
        if (
          message.type === 'loadoutCountdown' &&
          roomRef.current?.ready &&
          Number.isFinite(message.remainingMs)
        ) {
          setStartsAt(Date.now() + Math.max(0, message.remainingMs));
          return;
        }
        if (
          message.type === 'nameAccepted' &&
          roomRef.current &&
          !playerNameError(message.name)
        ) {
          onNameChange(message.name);
          setNamePending(false);
          setNameConfirmed(true);
          setError('');
          return;
        }
        if (message.type === 'rooms') {
          if (Array.isArray(message.rooms))
            setPublicRooms(
              message.rooms.filter(
                (room: PublicRoom) =>
                  room &&
                  typeof room.code === 'string' &&
                  /^[A-Z2-9]{6}$/.test(room.code) &&
                  [1, 2].includes(room.players),
              ),
            );
          return; // List updates must not clear a pending create/join request.
        }
        if (message.type === 'hit') {
          // Only the server-confirmed shooter receives this message; misses never flash.
          if (
            roomRef.current?.ready &&
            ['body', 'head', 'direct'].includes(message.kind) &&
            Number.isSafeInteger(message.sequence)
          ) {
            setHitMarker({ kind: message.kind, sequence: message.sequence });
          }
          return;
        }
        if (message.type === 'health' && roomRef.current?.ready) {
          if (
            !Array.isArray(message.players) ||
            message.players.length !== 2 ||
            !message.players.every(
              (p: { health: number }) =>
                Number.isInteger(p.health) && p.health >= 0 && p.health <= 100,
            )
          )
            return;
          const values = message.players.map(
            (p: { health: number }) => p.health,
          );
          healthRef.current = values;
          setHealth(values);
          const index = roomRef.current.player - 1;
          game?.setOnlineHealth(values[index], values[1 - index]);
          return;
        }
        if (message.type === 'effect') {
          const effect = readOnlineEffect(message);
          if (
            effect &&
            roomRef.current?.ready &&
            message.player !== roomRef.current.player
          )
            game?.receiveOnlineEffect(effect);
          return;
        }
        if (message.type === 'grenade') {
          if (
            roomRef.current?.ready &&
            message.player !== roomRef.current.player
          )
            game?.receiveOnlineGrenade(message);
          return;
        }
        if (message.type === 'shot') {
          if (
            roomRef.current?.ready &&
            message.player !== roomRef.current.player &&
            Object.hasOwn(WEAPON_DEFINITIONS, message.weapon)
          )
            game?.receiveOnlineShot(message.weapon);
          return;
        }
        if (message.type === 'equip') {
          if (
            roomRef.current?.ready &&
            message.player !== roomRef.current.player &&
            Object.hasOwn(WEAPON_DEFINITIONS, message.weapon)
          ) {
            remoteWeaponRef.current = message.weapon;
            game?.receiveOnlineWeapon(message.weapon);
            setRemoteWeapon(message.weapon);
          }
          return;
        }
        if (message.type === 'move') {
          if (
            roomRef.current?.ready &&
            message.player !== roomRef.current.player
          )
            game?.receiveOnlinePose(message.pose);
          return;
        }
        setPending(false);
        if (message.type === 'room') {
          if (!message.ready) {
            remoteWeaponRef.current = null;
            matchXp.current.stop();
            matchIdentity.current = null;
          } else if (
            matchIdentity.current !== `${message.code}:${message.matchId ?? 1}`
          ) {
            matchIdentity.current = `${message.code}:${message.matchId ?? 1}`;
            matchXp.current.begin();
            setLastRecap(null);
            setRecapOpen(false);
            setRematchStarting(message.rematching === true);
            roundRef.current = 1;
            setMatch({
              scores: [0, 0],
              round: 1,
              phase: 'playing',
              winner: null,
            });
          }
          message.profiles = Array.isArray(message.profiles)
            ? message.profiles.map(
                (value: unknown) =>
                  readPlayerProfile(value) ?? {
                    level: 1,
                    cosmetics: { ...EMPTY_COSMETICS },
                  },
              )
            : undefined;
          roomRef.current = message;
          setRoom(message);
          setError('');
          game?.receiveOnlineCosmetics(
            message.profiles?.[2 - message.player]?.cosmetics ??
              EMPTY_COSMETICS,
          );
          game?.receiveOnlineCharacter(
            roomRef.current?.profiles?.[2 - roomRef.current.player]
              ?.character ?? DEFAULT_CHARACTER,
          );
        }
        if (message.type === 'error') {
          setError(message.message);
          setNamePending(false);
        }
        if (message.type === 'closed' || message.type === 'left') {
          roomRef.current = null;
          setRoom(null);
          setError(message.message || '');
        }
      },
    });
    connection.current = transport;
    return () => {
      transport.dispose();
      connection.current = null;
    };
  }, [game, onNameChange]);
  useEffect(() => {
    if (!room?.ready) {
      roundRef.current = 1;
      setMatch({ scores: [0, 0], round: 1, phase: 'playing', winner: null });
      game?.setPreMatchLocked(false);
    }
    if (!room?.ready) {
      setStartsAt(null);
      setRestoreReady(false);
      setRematchStarting(false);
      pendingSnapshot.current = null;
      setNameConfirmed(false);
      setNamePending(false);
      setSelectionDone(false);
      setHitMarker(null);
      setHealth([100, 100]);
      healthRef.current = [100, 100];
      game?.enterLobby();
    }
  }, [room?.ready, room?.code, game]);
  useEffect(() => {
    if (!room?.ready || !game || !selectionDone) return;
    game.setArenaMap(isArenaMapId(room.mapId) ? room.mapId : DEFAULT_MAP);
    game.enterOnline(room.player);
    if (pendingEnvironment.current)
      game.setOnlineEnvironment(
        pendingEnvironment.current.state,
        pendingEnvironment.current.running,
      );
    if (pendingSnapshot.current) {
      game.restoreOnlineCombat(pendingSnapshot.current);
      pendingSnapshot.current = null;
    }
    game.setCosmetics(cosmeticsRef.current);
    game.receiveOnlineCosmetics(
      roomRef.current?.profiles?.[2 - room.player]?.cosmetics ??
        EMPTY_COSMETICS,
    );
    game?.receiveOnlineCharacter(
      roomRef.current?.profiles?.[2 - roomRef.current.player]?.character ??
        DEFAULT_CHARACTER,
    );
    game.setOnlineHealth(
      healthRef.current[room.player - 1],
      healthRef.current[2 - room.player],
    );
    connection.current?.send({
      type: 'combatReady',
      loadout: game?.onlineLoadout(),
    });
    game.setOnlineEffectListener((effect) => {
      // Capture pose, equipment and shot on one ordered connection. Never queue a shot.
      const transport = connection.current;
      if (!transport?.send({ type: 'move', pose: game.readOnlinePose() }))
        return;
      transport.send({ type: 'equip', weapon: game.readOnlineWeapon() });
      transport.send({
        type: 'effect',
        ...effect,
        sequence: ++shotSequence.current,
      });
    });
    // An equip message can arrive before React has entered the arena.
    if (remoteWeaponRef.current)
      game.receiveOnlineWeapon(remoteWeaponRef.current);
    setRemoteWeapon(remoteWeaponRef.current);
    let lastWeapon: WeaponId | null = null;
    const timer = setInterval(() => {
      const transport = connection.current;
      if (transport?.send({ type: 'move', pose: game.readOnlinePose() })) {
        const weapon = game.readOnlineWeapon();
        if (weapon !== lastWeapon) {
          transport.send({ type: 'equip', weapon });
          lastWeapon = weapon;
          setEquipped(weapon);
        }
      }
    }, MOVEMENT_SEND_MS);
    return () => {
      clearInterval(timer);
      game.setOnlineEffectListener(null);
      game.setOnlineShotListener(null);
      game.setOnlineGrenadeListener(null);
      game.setPreMatchLocked(false);
      game.enterLobby();
    };
  }, [
    room?.ready,
    room?.player,
    room?.code,
    room?.matchId,
    room?.mapId,
    game,
    selectionDone,
  ]);
  // Apply pause and countdown locks after arena initialization resets combat.
  useEffect(() => {
    if (!room?.ready || !game) return;
    const unavailable =
      !connected || network.reconnecting || room.paused === true;
    game.setOnlineNetworkPaused(unavailable);
    if (unavailable || rematchStarting || match.phase !== 'playing')
      game.setPreMatchLocked(true);
    else if (selectionDone) {
      game.setPreMatchLocked(false);
      game.setOnlineNetworkPaused(false);
    }
  }, [
    connected,
    network.reconnecting,
    room?.paused,
    room?.ready,
    room?.matchId,
    room?.code,
    selectionDone,
    rematchStarting,
    match.phase,
    game,
  ]);
  useEffect(() => {
    if (room?.code && connected) {
      const timer = setTimeout(() => {
        connection.current?.send({
          type: 'profile',
          profile: {
            level: career.level,
            cosmetics: career.cosmetics,
            character,
          },
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [room?.code, connected, career.level, career.cosmetics, character]);
  function send(type: 'create' | 'join' | 'leave', roomCode = code) {
    if (pending) return;
    if (
      connection.current?.send({
        type,
        code: roomCode,
        ...(type === 'create' ? { visibility, mapId } : {}),
      })
    ) {
      setError('');
      setPending(true);
    }
  }
  const reconnectNotice = (!connected ||
    network.reconnecting ||
    room?.paused) && (
    <output className="online-reconnect">
      <strong>
        {!connected || network.reconnecting
          ? 'Reconnecting to your match'
          : 'Opponent reconnecting'}
      </strong>
      <p>Match paused · Your score, health and ammo are kept for 30 seconds.</p>
      {!network.reconnecting && !connected && (
        <button onClick={() => connection.current?.retry()}>
          Retry connection
        </button>
      )}
      <button onClick={onBack}>Leave online</button>
    </output>
  );
  if (room?.ready && game && !nameConfirmed)
    return (
      <>
        <NameSelection
          game={game}
          onBack={onBack}
          busy={namePending}
          error={error}
          onConfirm={(name) => {
            if (playerNameError(name)) return;
            if (connection.current?.send({ type: 'setName', name })) {
              setError('');
              setNamePending(true);
            }
          }}
        />
        {reconnectNotice}
      </>
    );
  if (room?.ready && game && !selectionDone)
    return (
      <>
        <LoadoutSelection
          key={`${room.code}:${connected}:${network.reconnecting}:${restoreReady}`}
          game={game}
          loadout={loadout}
          startsAt={startsAt}
          readyInitially={restoreReady}
          suspended={!connected || room.paused || network.reconnecting}
          onReady={() => connection.current?.send({ type: 'loadoutReady' })}
          onComplete={() => setSelectionDone(true)}
        />
        {reconnectNotice}
      </>
    );
  if (room?.ready && game)
    return (
      <>
        <AimOverlay scoped={ammo.scoped} />
        <div className="career-dock match online-career">
          <ProgressionBar state={career} onOpen={onOpenCareer} compact />
        </div>
        <section
          className="online-movement-hud"
          aria-label="Online movement arena"
        >
          <div
            className="online-score"
            aria-label={`Score ${match.scores[0]} to ${match.scores[1]}, first to 5`}
          >
            <span>
              {room.names?.[0] || 'Player1'}{' '}
              <LevelBadge
                level={
                  room.player === 1
                    ? career.level
                    : (room.profiles?.[0]?.level ?? 1)
                }
              />
              <strong>{match.scores[0]}</strong>
            </span>
            <small>FIRST TO 5</small>
            <span>
              <strong>{match.scores[1]}</strong>
              {room.names?.[1] || 'Player2'}{' '}
              <LevelBadge
                level={
                  room.player === 2
                    ? career.level
                    : (room.profiles?.[1]?.level ?? 1)
                }
              />
            </span>
          </div>
          {(match.phase !== 'playing' || rematchStarting) && (
            <div className="online-round-result" role="status">
              <strong>
                {rematchStarting
                  ? 'REMATCH STARTING'
                  : match.phase === 'finished'
                    ? match.winner === room.player
                      ? 'VICTORY'
                      : 'DEFEAT'
                    : match.winner === room.player
                      ? 'ROUND WON'
                      : match.winner === null
                        ? 'DOUBLE KO'
                        : 'ROUND LOST'}
              </strong>
              <p>
                {rematchStarting
                  ? 'Get ready · Controls unlock in 3 seconds'
                  : match.phase === 'finished'
                    ? 'Same room · Same loadouts · Both players choose Rematch'
                    : 'Next round in 3 seconds · Health and ammo reset'}
              </p>
              {lastRecap &&
                !rematchStarting &&
                match.phase !== 'playing' &&
                match.winner !== room.player && (
                  <DeathRecap recap={lastRecap} />
                )}
              {match.phase === 'finished' && (
                <button
                  disabled={
                    !connected ||
                    room.paused ||
                    room.rematchReady?.[room.player - 1]
                  }
                  onClick={() => connection.current?.send({ type: 'rematch' })}
                >
                  {room.rematchReady?.[room.player - 1]
                    ? 'Waiting for opponent…'
                    : room.rematchReady?.[2 - room.player]
                      ? 'Accept rematch'
                      : 'Rematch'}
                </button>
              )}
            </div>
          )}
          {hitMarker && (
            <div
              key={hitMarker.sequence}
              className={`hit-marker online-hit-marker ${hitMarker.kind}`}
              aria-hidden="true"
              onAnimationEnd={() =>
                setHitMarker((current) =>
                  current?.sequence === hitMarker.sequence ? null : current,
                )
              }
            >
              <i />
              <i />
              <i />
              <i />
            </div>
          )}

          {reconnectNotice}
          <div className="online-room-tag">
            <strong>EDGEFRONT / {room.code}</strong>
            <p>
              {ARENA_MAPS[room.mapId ?? DEFAULT_MAP]?.name ?? 'Stadium'} · First
              to 5
            </p>
          </div>
          <div className="online-health-strip" aria-label="Server health">
            {health.map((hp, index) => (
              <div
                key={index}
                className={
                  index === room.player - 1 ? 'online-self' : 'online-opponent'
                }
              >
                <label htmlFor={`online-hp-${index}`}>
                  <span className="online-player-name">
                    {room.names?.[index] || `Player${index + 1}`}
                    {index === room.player - 1 ? ' · You' : ''}
                  </span>
                  <strong>
                    {hp}
                    <small> HP</small>
                  </strong>
                </label>
                <progress id={`online-hp-${index}`} value={hp} max={100} />
                <span>
                  {hp === 0
                    ? 'Eliminated'
                    : index === room.player - 1
                      ? 'Connected'
                      : remoteWeapon
                        ? WEAPON_DEFINITIONS[remoteWeapon].name
                        : 'Connecting…'}
                </span>
              </div>
            ))}
          </div>
          <div className="online-ammo" aria-label="Your ammo">
            <span>{WEAPON_DEFINITIONS[equipped].name}</span>
            <strong>
              {ammo.fireMode === 'Melee' ? (
                'Melee'
              ) : ammo.fireMode === 'Beam' ? (
                `${ammo.ammo}%`
              ) : (
                <>
                  {ammo.ammo}
                  <small> / {ammo.reserveAmmo}</small>
                </>
              )}
            </strong>
            <span>
              {ammo.reloading
                ? 'Reloading…'
                : ammo.fireMode === 'Beam'
                  ? 'Energy'
                  : ammo.fireMode}
            </span>
          </div>
          <nav className="online-weapon-dock" aria-label="Online weapon slots">
            {game.onlineLoadout().map((id, index) => (
              <button
                key={id}
                aria-pressed={equipped === id}
                onClick={() => {
                  game.selectWeapon(id);
                  setEquipped(game.readOnlineWeapon());
                }}
              >
                <kbd>{index + 1}</kbd>
                <span>{WEAPON_DEFINITIONS[id].name}</span>
              </button>
            ))}
          </nav>
          {recapOpen && lastRecap && (
            <DeathRecapDialog
              recap={lastRecap}
              onClose={() => setRecapOpen(false)}
            />
          )}
          <div className="online-actions">
            <output className="online-network-status">
              {connected && !network.reconnecting
                ? network.rttMs === null
                  ? 'Measuring ping…'
                  : `${network.rttMs} ms · ${network.rttMs < 80 ? 'Good' : network.rttMs < 180 ? 'Fair' : 'High ping'}`
                : 'Reconnecting…'}
            </output>
            {lastRecap && (
              <button
                onClick={() => {
                  if (document.pointerLockElement) document.exitPointerLock();
                  setRecapOpen(true);
                }}
              >
                Death recap / Replay
              </button>
            )}
            {paused &&
              connected &&
              !network.reconnecting &&
              !room.paused &&
              !rematchStarting &&
              match.phase === 'playing' &&
              health[room.player - 1] > 0 && (
                <button
                  className="online-resume"
                  onClick={() => game.requestPointerLock()}
                >
                  Click to move
                </button>
              )}
            <button onClick={onBack}>Leave arena</button>
          </div>
          <p className="online-control-hint">
            1–4 Switch · R Reload · Esc Cursor
          </p>
        </section>
      </>
    );
  return (
    <section className="online-screen" aria-label="1v1 Online">
      <div className="online-card">
        <p className="eyebrow">EDGEFRONT / ONLINE ROOMS</p>
        <h1>1v1 Online</h1>
        <button
          className="primary-button shop-open-button"
          onClick={onOpenCareer}
        >
          Level rewards & cosmetics
        </button>
        <p>
          First to 5 eliminations wins. Guns, melee, rockets, grenades and
          Molotov fire all deal damage. Both players reset after each round.
        </p>
        <p role="status">
          {connected
            ? network.rttMs === null
              ? 'Server connected · Measuring ping…'
              : `Server connected · ${network.rttMs} ms`
            : network.reconnecting
              ? `Reconnecting · Attempt ${network.attempt}`
              : 'Server disconnected'}
        </p>
        {!connected && !network.reconnecting && (
          <button onClick={() => connection.current?.retry()}>
            Retry connection
          </button>
        )}
        {!room ? (
          <>
            <MapPicker
              value={mapId}
              onChange={setMapId}
              disabled={!connected || pending}
            />
            <fieldset
              className="room-visibility"
              disabled={!connected || pending}
            >
              <legend>Create a room</legend>
              {(['private', 'public'] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="room-visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                  />
                  <span>
                    {value === 'private' ? 'Private' : 'Public'}
                    <small>
                      {value === 'private'
                        ? 'Join by code only'
                        : 'Listed for everyone on this server'}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            <button
              className="primary-button"
              disabled={!connected || pending}
              onClick={() => send('create')}
            >
              Create Room
            </button>
            <label htmlFor="room-code">Room Code</label>
            <input
              id="room-code"
              value={code}
              maxLength={6}
              placeholder="ABC234"
              autoComplete="off"
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))
              }
            />
            <div className="online-buttons">
              <button
                className="primary-button"
                disabled={!connected || pending || code.length !== 6}
                onClick={() => send('join')}
              >
                Join Room
              </button>
            </div>
            <section className="public-room-browser" aria-label="Public rooms">
              <h2>
                Public rooms <span>{publicRooms?.length ?? 0}</span>
              </h2>
              <p className="room-list-note">
                Updates automatically · Private rooms are never listed
              </p>
              {!connected ? (
                <p>Connect to the server to browse rooms.</p>
              ) : publicRooms === null ? (
                <p>Waiting for room list…</p>
              ) : publicRooms.length === 0 ? (
                <p>No public rooms yet. Create one above.</p>
              ) : (
                <ul>
                  {publicRooms.map((item) => (
                    <li key={item.code}>
                      <div>
                        <strong>Room {item.code}</strong>
                        <small>
                          {isArenaMapId(item.mapId)
                            ? ARENA_MAPS[item.mapId].name
                            : 'Stadium'}{' '}
                          · {item.players} / 2 players ·{' '}
                          {item.players === 2 ? 'Full' : 'Waiting for opponent'}
                        </small>
                      </div>
                      <button
                        className="primary-button"
                        disabled={pending || item.players === 2}
                        onClick={() => send('join', item.code)}
                        aria-label={`Join room ${item.code}`}
                      >
                        {item.players === 2 ? 'Full' : 'Join'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <div className="online-room" aria-live="polite">
            <p>
              {room.visibility === 'public'
                ? 'Public · Listed in the room browser'
                : 'Private · Share this code with a friend'}
            </p>
            <p>
              {ARENA_MAPS[room.mapId ?? DEFAULT_MAP].name} ·{' '}
              {ARENA_MAPS[room.mapId ?? DEFAULT_MAP].difficulty} terrain
            </p>
            <p>
              Room Code <strong>{room.code}</strong>
            </p>
            <p>
              You are Player {room.player} <LevelBadge level={career.level} />
            </p>
            <p>
              Player 1 {room.players[0] ? 'Connected' : 'Waiting'}{' '}
              {room.players[0] && (
                <LevelBadge level={room.profiles?.[0]?.level ?? 1} />
              )}
            </p>
            <p>
              Player 2 {room.players[1] ? 'Connected' : 'Waiting'}{' '}
              {room.players[1] && (
                <LevelBadge level={room.profiles?.[1]?.level ?? 1} />
              )}
            </p>
            <h2>{room.ready ? 'Ready' : 'Waiting for Player 2'}</h2>
            <p>The arena opens when Player 2 connects.</p>
            <button
              className="primary-button"
              disabled={pending}
              onClick={() => send('leave')}
            >
              Leave Room
            </button>
          </div>
        )}
        {error && (
          <p className="online-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button shop-open-button" onClick={onBack}>
          Back to play menu
        </button>
      </div>
    </section>
  );
}
