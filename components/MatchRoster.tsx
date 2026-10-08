import type { MatchParticipant, SpectatorState } from '@/game/createSpectator';
import { WEAPON_DEFINITIONS } from '@/game/weaponDefinitions';
import { LevelBadge } from './Progression';
import './MatchRoster.css';

export function MatchRoster({
  players,
  localSlot,
  spectator,
  onSelect,
  team,
  opposing = false,
}: {
  players: MatchParticipant[];
  localSlot: number;
  spectator?: SpectatorState | null;
  onSelect: (slot: number) => void;
  team?: 0 | 1;
  opposing?: boolean;
}) {
  return (
    <aside
      className={`match-roster${team !== undefined ? ' split-match-roster' : ''}${opposing ? ' opposing-match-roster' : ''}`}
      aria-label={
        opposing ? 'Opposing team players' : 'Individual match players'
      }
    >
      {(team === undefined ? [0, 1] : [team]).map((team) => (
        <section
          key={team}
          className={team === 0 ? 'cyan-roster' : 'coral-roster'}
        >
          <h3>
            <span>
              {opposing
                ? 'Opposing team'
                : team === 0
                  ? 'Cyan team'
                  : 'Coral team'}
            </span>
            <small>
              {
                players.filter(
                  (p) => p.team === team && p.connected && p.health > 0,
                ).length
              }{' '}
              alive
            </small>
          </h3>
          {players
            .filter((p) => p.team === team)
            .map((p) => {
              const watchable = spectator?.options.some(
                (a) => a.slot === p.slot,
              );
              return (
                <button
                  key={p.slot}
                  disabled={!watchable}
                  onClick={() => onSelect(p.slot)}
                  className={p.health <= 0 ? 'eliminated' : ''}
                  aria-pressed={spectator?.target?.slot === p.slot}
                >
                  <span className="roster-name">
                    {p.name}
                    {p.slot === localSlot ? ' (You)' : ''}
                    {p.level !== undefined && <LevelBadge level={p.level} />}
                  </span>
                  <span className="roster-status">
                    {!p.connected
                      ? 'Offline'
                      : p.health <= 0
                        ? 'Eliminated'
                        : `${Math.ceil(p.health)} HP`}
                    {p.kills !== undefined &&
                      ` · ${p.kills}K / ${p.deaths ?? 0}D`}
                    {spectator?.target?.slot === p.slot
                      ? ' · Watching'
                      : watchable
                        ? ' · Spectate'
                        : ''}
                  </span>
                  <i className="roster-health">
                    <i
                      style={{
                        width: `${Math.max(0, Math.min(100, p.health))}%`,
                      }}
                    />
                  </i>
                </button>
              );
            })}
        </section>
      ))}
    </aside>
  );
}

export function SpectatorControls({
  state,
  onCycle,
  onRecap,
  intermission,
}: {
  state: SpectatorState;
  onCycle: (direction: number) => void;
  onRecap?: () => void;
  intermission: boolean;
}) {
  return (
    <section className="spectator-controls" aria-label="Spectator controls">
      <small>
        {intermission
          ? 'ROUND OVER · SPECTATING'
          : 'ELIMINATED · SPECTATING TEAMMATES'}
      </small>
      <strong>{state.target?.name ?? 'Waiting for the next round'}</strong>
      {state.target && (
        <span>
          {Math.ceil(state.target.health)} HP ·{' '}
          {WEAPON_DEFINITIONS[state.target.weapon].name}
        </span>
      )}
      <div>
        <button
          disabled={state.options.length < 2}
          onClick={() => onCycle(-1)}
          aria-label="Spectate previous player"
        >
          ← Previous
        </button>
        <button
          disabled={state.options.length < 2}
          onClick={() => onCycle(1)}
          aria-label="Spectate next player"
        >
          Next →
        </button>
        {onRecap && <button onClick={onRecap}>Death recap</button>}
      </div>
    </section>
  );
}
