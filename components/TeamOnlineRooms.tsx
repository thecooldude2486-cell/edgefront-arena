'use client';
import { useEffect, useRef, useState } from 'react';
import type { OnlineGame } from '@/game/onlineMovement';
import { readCombatSnapshot } from '@/game/onlineSnapshot';
import type { TeamRoomState } from '@/game/teamProtocol';
import { mapsForTeams, teamOf, type TeamSize } from '@/game/teams';
import { ARENA_MAPS } from '@/game/maps';
import { MapArtwork } from './MapArtwork';
import { MatchRoster, SpectatorControls } from './MatchRoster';
import type { SpectatorState } from '@/game/createSpectator';
import { TeamPreferencePicker } from './TeamPreferencePicker';
import type { TeamPreference } from '@/game/teams';
import { TeamSizePicker } from './TeamSizePicker';
import { LoadoutSelection, type LoadoutChoices } from './LoadoutSelection';
import { DeathRecap, DeathRecapDialog } from './DeathRecap';
import { AimOverlay } from './AimOverlay';
import type { ProgressionState } from './Progression';
import type { CharacterAppearance } from '@/game/storeCatalog';
import { eliminationXp } from '@/game/combatXp';
import { WEAPON_DEFINITIONS, type WeaponId } from '@/game/weaponDefinitions';
import { readDeathRecap } from '@/game/deathRecap';
import './OnlineRooms.css';
import './Teams.css';
const KEY = 'edgefront.team.session.v1';
export function TeamOnlineRooms({
  game,
  onBack,
  loadout,
  career,
  character,
  onXp,
  onNameChange,
  ammo,
  paused,
  spectator,
  onMatchStateChange,
}: {
  game: OnlineGame | null;
  onBack: () => void;
  loadout: LoadoutChoices;
  career: ProgressionState;
  character: CharacterAppearance;
  onXp: (n: number, bonuses?: string[]) => void;
  onNameChange: (name: string) => void;
  ammo: {
    ammo: number;
    reserveAmmo: number;
    reloading: boolean;
    scoped: boolean;
    weaponId: WeaponId;
  };
  paused: boolean;
  spectator: SpectatorState | null;
  onMatchStateChange: (active: boolean) => void;
}) {
  const [size, setSize] = useState<TeamSize>(1),
    [code, setCode] = useState(''),
    [name, setName] = useState(''),
    [visibility, setVisibility] = useState('private'),
    [hostTeam, setHostTeam] = useState<TeamPreference>('auto'),
    [joinTeam, setJoinTeam] = useState<TeamPreference>('auto'),
    [teamNotice, setTeamNotice] = useState(''),
    [room, setRoom] = useState<TeamRoomState | null>(null),
    [connected, setConnected] = useState(false),
    [error, setError] = useState(''),
    [ping, setPing] = useState<number | null>(null),
    [clock, setClock] = useState(() => Date.now()),
    [recapOpen, setRecapOpen] = useState(false),
    [dismissedRecap, setDismissedRecap] =
      useState<TeamRoomState['recap']>(null),
    [hit, setHit] = useState(''),
    [list, setList] = useState<
      { code: string; size: number; players: number; phase: string }[]
    >([]);
  const savedRecap = useRef<{
      key: string;
      value: ReturnType<typeof readDeathRecap>;
    } | null>(null),
    needsResume = useRef(false);
  const socket = useRef<WebSocket | null>(null),
    roomRef = useRef<TeamRoomState | null>(null),
    token = useRef<string | null>(null),
    sequence = useRef(0),
    entered = useRef(''),
    pendingSnapshot = useRef<ReturnType<typeof readCombatSnapshot>>(null),
    xpKills = useRef(0),
    xpDeaths = useRef(0),
    xpFinished = useRef(false),
    onXpRef = useRef(onXp);
  const inMatch =
    !!room && ['playing', 'intermission', 'finished'].includes(room.phase);
  useEffect(() => {
    onMatchStateChange(inMatch);
  }, [inMatch, onMatchStateChange]);
  useEffect(() => {
    onXpRef.current = onXp;
  }, [onXp]);
  const send = (m: unknown) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify(m));
    return true;
  };
  useEffect(() => {
    let stopped = false,
      retry: ReturnType<typeof setTimeout> | null = null,
      lastReceived = Date.now(),
      disconnectedAt = 0,
      attempt = 0;
    try {
      token.current = sessionStorage.getItem(KEY);
    } catch {}
    const local = ['localhost', '127.0.0.1'].includes(location.hostname),
      url =
        import.meta.env.VITE_MULTIPLAYER_URL ||
        (local ? 'ws://localhost:3008' : '');
    if (!url) {
      queueMicrotask(() => {
        if (!stopped) setError('Online room server is not configured.');
      });
      return;
    }
    function connect() {
      if (stopped) return;
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onopen = () => {
        attempt = 0;
        disconnectedAt = 0;
        setConnected(true);
        lastReceived = Date.now();
        ws.send(JSON.stringify({ type: 'enableResume' }));
        if (token.current)
          ws.send(JSON.stringify({ type: 'teamResume', token: token.current }));
      };
      ws.onmessage = (e) => {
        lastReceived = Date.now();
        let m;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        if (m.type === 'netProbe') {
          ws.send(JSON.stringify({ type: 'netAck', id: m.id }));
          return;
        }
        if (m.type === 'netStats') {
          setPing(m.rttMs);
          return;
        }
        if (m.type === 'teamNotice') {
          setTeamNotice(m.message);
          return;
        }
        if (m.type === 'teamError') {
          setError(m.message);
          if (/expired/.test(m.message)) {
            token.current = null;
            try {
              sessionStorage.removeItem(KEY);
            } catch {}
            roomRef.current = null;
            setRoom(null);
            game?.enterLobby();
          }
          return;
        }
        if (m.type === 'teamList') {
          setList(m.rooms);
          return;
        }
        if (m.type === 'teamLeft') {
          token.current = null;
          try {
            sessionStorage.removeItem(KEY);
          } catch {}
          roomRef.current = null;
          setRoom(null);
          entered.current = '';
          game?.enterLobby();
          return;
        }
        if (m.type === 'teamSync') {
          const snapshot = readCombatSnapshot(m.snapshot);
          if (snapshot) {
            sequence.current = Math.max(sequence.current, snapshot.sequence);
            pendingSnapshot.current = snapshot;
            if (roomRef.current?.phase === 'playing' && game) {
              game.restoreOnlineCombat(snapshot);
              pendingSnapshot.current = null;
            }
          }
          return;
        }
        if (m.type === 'hit') {
          setHit(m.kind);
          setTimeout(() => setHit(''), 160);
          return;
        }
        if (m.type === 'teamEffect') {
          game?.receiveTeamEffect(m.slot, m.effect);
          return;
        }
        if (m.type !== 'teamState') return;
        const next = m as TeamRoomState;
        const prior = roomRef.current;
        const own = next.players[next.slot];
        if (!own) return;
        if (!prior || prior.code !== next.code || next.round < prior.round) {
          savedRecap.current = null;
          xpKills.current = own.kills;
          xpDeaths.current = own.deaths;
          xpFinished.current = next.phase === 'finished';
        } else if (own.kills > xpKills.current) {
          const award = eliminationXp(next.performance);
          onXpRef.current(
            award.amount * (own.kills - xpKills.current) * 2,
            award.bonuses,
          );
          xpKills.current = own.kills;
        }
        if (own.deaths > xpDeaths.current) {
          onXpRef.current(
            (25 +
              Math.round(Math.min(100, next.performance.damageDealt) * 0.2)) *
              (own.deaths - xpDeaths.current) *
              2,
          );
          xpDeaths.current = own.deaths;
        }
        if (prior && next.phase === 'finished' && !xpFinished.current) {
          xpFinished.current = true;
          onXpRef.current(
            next.winner === teamOf(next.slot, next.size) ? 300 : 150,
          );
        }
        const recapKey = next.code + ':' + next.round + ':' + own.deaths;
        if (next.recap) {
          if (savedRecap.current?.key !== recapKey)
            savedRecap.current = {
              key: recapKey,
              value: readDeathRecap(next.recap),
            };
          next.recap = savedRecap.current?.value ?? null;
        }
        roomRef.current = next;
        setRoom(next);
        setError('');
        token.current = next.token;
        try {
          sessionStorage.setItem(KEY, next.token);
        } catch {}
        if (next.paused) {
          game?.setOnlineNetworkPaused(true);
          return;
        }
        if (next.phase === 'playing') {
          const identity = next.code + ':' + next.round;
          if (entered.current !== identity) {
            entered.current = identity;
            game?.setPreMatchLocked(false);
            game?.setArenaMap(next.mapId);
            game?.enterTeamOnline(next.slot, next.size);
            onNameChange(own.name);
            if (pendingSnapshot.current) {
              game?.restoreOnlineCombat(pendingSnapshot.current);
              pendingSnapshot.current = null;
            }
            game?.setOnlineEffectListener((effect) => {
              if (!game || !send({ type: 'move', pose: game.readOnlinePose() }))
                return;
              send({ type: 'equip', weapon: game.readOnlineWeapon() });
              send({ type: 'effect', ...effect, sequence: ++sequence.current });
            });
            if (game) {
              send({ type: 'move', pose: game.readOnlinePose() });
              send({ type: 'equip', weapon: game.readOnlineWeapon() });
            }
          }
          if (prior?.paused || needsResume.current) {
            game?.setOnlineNetworkPaused(false);
            needsResume.current = false;
          }
          game?.receiveTeamRoster(next.players);
          game?.setOnlineHealth(own.health, 100);
          game?.setOnlineEnvironment(next.environment, true);
        } else {
          game?.setPreMatchLocked(true);
          if (next.phase === 'intermission' || next.phase === 'finished') {
            game?.receiveTeamRoster(next.players, true);
            game?.setOnlineHealth(own.health, 100);
          }
          game?.setOnlineEnvironment(next.environment, false);
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        setConnected(false);
        setPing(null);
        needsResume.current = true;
        game?.setOnlineNetworkPaused(true);
        if (!disconnectedAt) disconnectedAt = Date.now();
        if (Date.now() - disconnectedAt < 30000)
          retry = setTimeout(connect, Math.min(3000, 500 * 2 ** attempt++));
        else setError('Reconnect timed out. Leave and join a room again.');
      };
      ws.onerror = () => ws.close();
    }
    connect();
    const timer = setInterval(() => {
      setClock(Date.now());
      if (
        socket.current?.readyState === WebSocket.OPEN &&
        Date.now() - lastReceived > 10000
      )
        socket.current.close();
      const r = roomRef.current;
      if (
        r?.phase === 'playing' &&
        !r.paused &&
        game &&
        r.players[r.slot].health > 0
      )
        send({ type: 'move', pose: game.readOnlinePose() });
    }, 50);
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      clearInterval(timer);
      send({ type: 'teamLeave' });
      try {
        sessionStorage.removeItem(KEY);
      } catch {}
      socket.current?.close();
      game?.setOnlineEffectListener(null);
      game?.setPreMatchLocked(false);
      game?.enterLobby();
    };
  }, [game, onNameChange]);
  const roomCode = room?.code;
  useEffect(() => {
    if (roomCode && connected)
      send({
        type: 'teamProfile',
        profile: {
          level: career.level,
          cosmetics: career.cosmetics,
          character,
        },
      });
  }, [career.level, career.cosmetics, character, roomCode, connected]);
  const back = () => {
    send({ type: 'teamLeave' });
    token.current = null;
    onBack();
  };
  const remaining = room?.deadline
    ? Math.max(0, Math.ceil((room.deadline - clock) / 1000))
    : 0;
  if (!room)
    return (
      <section className="start-screen team-room-setup">
        <div className="start-card">
          <button onClick={back}>Back to lobby</button>
          <h1>Online team arena</h1>
          <TeamSizePicker value={size} onChange={setSize} />
          {size > 1 && (
            <TeamPreferencePicker value={hostTeam} onChange={setHostTeam} />
          )}
          <label>
            Visibility{' '}
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </label>
          <button
            disabled={!connected}
            className="primary-button"
            onClick={() =>
              send({
                type: 'teamCreate',
                size,
                visibility,
                team: hostTeam,
              })
            }
          >
            Create {size}v{size} room
            {size > 1 &&
              hostTeam !== 'auto' &&
              ` · ${hostTeam === 0 ? 'Cyan' : 'Coral'}`}
          </button>
          <h2 className="join-room-heading">Join a room</h2>
          <TeamPreferencePicker
            value={joinTeam}
            onChange={setJoinTeam}
            joining
          />
          <label>
            Room code{' '}
            <input
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <button
            disabled={!connected || code.length !== 6}
            onClick={() => send({ type: 'teamJoin', code, team: joinTeam })}
          >
            Join room
          </button>
          <button
            disabled={!connected}
            onClick={() => send({ type: 'teamList' })}
          >
            Find public rooms
          </button>
          {list.map((r) => (
            <button
              key={r.code}
              disabled={r.phase !== 'waiting' || r.players >= r.size * 2}
              onClick={() =>
                send({ type: 'teamJoin', code: r.code, team: joinTeam })
              }
            >
              {r.size}v{r.size} · {r.players}/{r.size * 2} · {r.code}
            </button>
          ))}
          {error && <p role="alert">{error}</p>}
          <small>
            {connected ? 'Connected' : 'Connecting to room server…'}
          </small>
        </div>
      </section>
    );
  const own = room.players[room.slot],
    team = teamOf(room.slot, room.size);
  if (!['playing', 'intermission', 'finished'].includes(room.phase))
    return (
      <section className="start-screen team-room-setup">
        <div className="start-card">
          <button onClick={back}>Leave room</button>
          <h1>
            {room.size}v{room.size} · {room.code}
          </h1>
          <p>
            {room.players.filter((p) => p.connected).length}/{room.size * 2}{' '}
            players ·{' '}
            {room.phase === 'waiting'
              ? 'Waiting for all players'
              : room.phase === 'voting'
                ? `Map vote · ${remaining}s`
                : 'Choose loadout and ready up'}
          </p>
          {room.size > 1 && (
            <output className="team-assignment">
              {teamNotice ||
                `You are on ${team === 0 ? 'Cyan' : 'Coral'} team.`}
            </output>
          )}
          <div className="team-lobby-roster">
            {[0, 1].map((t) => {
              const members = room.players.filter(
                (p) => teamOf(p.slot, room.size) === t,
              );
              const occupied = members.filter(
                (p) => p.occupied ?? p.connected,
              ).length;
              return (
                <section
                  key={t}
                  className={t === 0 ? 'cyan-choice' : 'coral-choice'}
                >
                  <strong>
                    {t === 0 ? 'CYAN' : 'CORAL'} TEAM · {occupied}/{room.size}
                  </strong>
                  {members.map((p) => (
                    <span key={p.slot}>
                      {p.connected
                        ? p.name
                        : p.occupied
                          ? `${p.name} · Reconnecting`
                          : 'Open slot'}
                      {p.slot === room.slot ? ' (You)' : ''}{' '}
                      {p.ready ? '✓' : ''}
                    </span>
                  ))}
                  {room.size > 1 && (
                    <button
                      disabled={
                        room.phase !== 'waiting' ||
                        room.paused ||
                        team === t ||
                        occupied >= room.size
                      }
                      onClick={() => send({ type: 'teamChoose', team: t })}
                    >
                      {team === t
                        ? 'Your team'
                        : occupied >= room.size
                          ? 'Team full'
                          : `Join ${t === 0 ? 'Cyan' : 'Coral'}`}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
          <label>
            Your name{' '}
            <input
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button onClick={() => send({ type: 'teamName', name })}>
            Set name
          </button>
          {room.phase === 'voting' && (
            <section aria-label="Map voting" className="online-map-voting">
              <output className="map-vote-summary">
                {room.votes.filter(Boolean).length}/{room.size * 2} votes cast ·{' '}
                {remaining}s remaining
              </output>
              <p>
                Choose one of five {room.size}v{room.size} arenas. You can
                change your vote until everyone votes or the timer ends. Most
                votes wins; ties are random.
              </p>
              <div className="map-vote">
                {mapsForTeams(room.size).map((id) => (
                  <button
                    key={id}
                    aria-pressed={room.votes[room.slot] === id}
                    disabled={room.paused}
                    onClick={() => send({ type: 'teamVote', mapId: id })}
                  >
                    <MapArtwork id={id} />
                    <strong>{ARENA_MAPS[id].name}</strong>
                    <small>
                      {ARENA_MAPS[id].difficulty} terrain ·{' '}
                      {ARENA_MAPS[id].description}
                    </small>
                    <b>
                      {room.votes.filter((v) => v === id).length} votes{' '}
                      {room.votes[room.slot] === id ? '· Your vote' : ''}
                    </b>
                  </button>
                ))}
              </div>
            </section>
          )}
          {(room.phase === 'loadout' || room.phase === 'countdown') && (
            <p className="selected-map-result">
              Selected arena · <strong>{ARENA_MAPS[room.mapId].name}</strong> ·{' '}
              {room.size}v{room.size}
            </p>
          )}
          {(room.phase === 'loadout' || room.phase === 'countdown') && game && (
            <LoadoutSelection
              game={game}
              loadout={loadout}
              readyInitially={own.ready}
              startsAt={room.phase === 'countdown' ? room.deadline : null}
              onReady={() =>
                send({ type: 'teamReady', loadout: game.onlineLoadout() })
              }
              onComplete={() => {}}
              suspended={room.paused}
            />
          )}
          <p>
            {room.paused ? 'Reconnect pause · seat held for 30 seconds' : error}
          </p>
        </div>
      </section>
    );
  return (
    <div className="online-movement-hud team-match-hud">
      {own.health > 0 && !spectator && <AimOverlay scoped={ammo.scoped} />}
      <section className="online-score">
        <span>
          CYAN <strong>{room.scores[0]}</strong>
        </span>
        <small>
          {room.size}v{room.size} · Round {room.round} ·{' '}
          {ARENA_MAPS[room.mapId].name}
        </small>
        <span>
          CORAL <strong>{room.scores[1]}</strong>
        </span>
      </section>
      <MatchRoster
        players={room.players.map((p) => ({
          ...p,
          team: teamOf(p.slot, room.size),
          level: p.profile.level,
        }))}
        localSlot={room.slot}
        spectator={spectator}
        onSelect={(slot) => game?.spectatePlayer(slot)}
      />
      {spectator && (!room.recap || room.recap === dismissedRecap) && (
        <SpectatorControls
          state={spectator}
          intermission={room.phase !== 'playing'}
          onCycle={(direction) => game?.cycleSpectator(direction)}
          onRecap={room.recap ? () => setRecapOpen(true) : undefined}
        />
      )}
      <div className="online-actions">
        <span className="online-network-status">
          {connected
            ? ping === null
              ? 'Connected'
              : `${ping} ms`
            : 'Reconnecting…'}
        </span>
        <button onClick={back}>Leave room</button>
        {room.recap && (
          <button
            onClick={() => {
              if (document.pointerLockElement) document.exitPointerLock();
              setRecapOpen(true);
            }}
          >
            Death recap / Replay
          </button>
        )}
      </div>
      <nav className="online-weapon-dock" aria-label="Online weapon slots">
        {game?.onlineLoadout().map((id, index) => (
          <button
            key={id}
            aria-pressed={ammo.weaponId === id}
            onClick={() => game.selectWeapon(id)}
            disabled={
              own.health === 0 || room.phase !== 'playing' || room.paused
            }
          >
            <kbd>{index + 1}</kbd>
            <span>{WEAPON_DEFINITIONS[id].name}</span>
          </button>
        ))}
      </nav>
      {own.health > 0 && (
        <div className="team-local-health">
          {own.health} HP · {WEAPON_DEFINITIONS[ammo.weaponId].name} ·{' '}
          {ammo.ammo}/{ammo.reserveAmmo}
          {ammo.reloading ? ' · Reloading' : ''}
        </div>
      )}
      {hit && (
        <div className={'hit-marker ' + hit}>
          <i />
          <i />
          <i />
          <i />
        </div>
      )}
      {recapOpen && room.recap && (
        <DeathRecapDialog
          recap={room.recap}
          onClose={() => setRecapOpen(false)}
        />
      )}
      {(room.phase !== 'playing' ||
        (own.health === 0 && room.recap && room.recap !== dismissedRecap)) && (
        <div className="online-round-result">
          <strong>
            {room.phase === 'finished'
              ? room.winner === team
                ? 'VICTORY'
                : 'DEFEAT'
              : room.phase === 'intermission'
                ? `INTERMISSION · ${remaining}s`
                : 'Eliminated · Your team is still fighting'}
          </strong>
          {own.health === 0 && room.recap && room.recap !== dismissedRecap && (
            <DeathRecap
              recap={room.recap}
              onClose={() => setDismissedRecap(room.recap)}
              onPlaybackComplete={() => setDismissedRecap(room.recap)}
            />
          )}{' '}
          {room.phase === 'finished' && (
            <button
              disabled={own.ready}
              onClick={() => send({ type: 'teamRematch' })}
            >
              {own.ready ? 'Waiting for everyone' : 'Rematch & vote'}
            </button>
          )}
        </div>
      )}
      {paused && own.health > 0 && room.phase === 'playing' && !room.paused && (
        <section className="pause-screen">
          <button
            className="primary-button"
            onClick={() => game?.requestPointerLock()}
          >
            Enter / Resume
          </button>
        </section>
      )}
      {room.paused && (
        <section className="pause-screen">
          Player reconnecting · Match paused for up to 30 seconds
        </section>
      )}
    </div>
  );
}
