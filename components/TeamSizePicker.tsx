'use client';
import type { TeamSize } from '@/game/teams';
export function TeamSizePicker({
  value,
  onChange,
}: {
  value: TeamSize;
  onChange: (n: TeamSize) => void;
}) {
  return (
    <fieldset className="team-size-picker">
      <legend>Team size</legend>
      <div>
        {([1, 2, 3, 4, 5] as TeamSize[]).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={n === value}
            onClick={() => onChange(n)}
          >
            {n}v{n}
          </button>
        ))}
      </div>
      <small>
        One life per round · First team to 5 rounds · No friendly fire
      </small>
    </fieldset>
  );
}
