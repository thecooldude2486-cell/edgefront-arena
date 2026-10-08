'use client';

import { ARENA_MAPS, type ArenaMapId } from '@/game/maps';
import { mapsForTeams } from '@/game/teams';
import { MapArtwork } from './MapArtwork';
import './MapPicker.css';
export function MapPicker({
  value,
  onChange,
  disabled = false,
  teamSize = 1,
}: {
  value: ArenaMapId;
  onChange: (id: ArenaMapId) => void;
  disabled?: boolean;
  teamSize?: number;
}) {
  return (
    <fieldset className="map-picker" disabled={disabled}>
      <legend>
        {teamSize}v{teamSize} · Select map · 5 arenas
      </legend>
      <div>
        {mapsForTeams(teamSize).map((id) => (
          <label
            key={id}
            style={
              { '--map-color': ARENA_MAPS[id].color } as React.CSSProperties
            }
          >
            <input
              type="radio"
              name="arena-map"
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
            />
            <MapArtwork id={id} />
            <strong>{ARENA_MAPS[id].name}</strong>
            <small>{ARENA_MAPS[id].difficulty}</small>
          </label>
        ))}
      </div>
      <p>{ARENA_MAPS[value].description}</p>
      <p className="map-traversal-tip">
        Cyan docks → moving ferries. High perches need a Comet/Pulse blast jump
        or Orbiter grapple. Amber oil barrels explode when shot. Miss a landing
        and the void is lethal.
      </p>
      <small>
        Map difficulty describes the terrain. Choose Rook’s skill separately.
        Online matches vote on these five maps; bot training uses your
        selection.
      </small>
    </fieldset>
  );
}
