import type { TeamPreference } from '@/game/teams';
export function TeamPreferencePicker({
  value,
  onChange,
  joining = false,
}: {
  value: TeamPreference;
  onChange: (team: TeamPreference) => void;
  joining?: boolean;
}) {
  return (
    <fieldset className="team-preference-picker">
      <legend>
        {joining ? 'Team when joining 2v2–5v5' : 'Your team as host'}
      </legend>
      <div>
        {(['auto', 0, 1] as const).map((team) => (
          <button
            key={team}
            type="button"
            aria-pressed={value === team}
            className={
              team === 0 ? 'cyan-choice' : team === 1 ? 'coral-choice' : ''
            }
            onClick={() => onChange(team)}
          >
            {team === 'auto' ? 'Auto assign' : team === 0 ? 'Cyan' : 'Coral'}
          </button>
        ))}
      </div>
      <p>
        {joining
          ? 'If your chosen team is full, you’ll join the other team. 1v1 assigns opponents automatically.'
          : 'Choose Cyan or Coral before creating your room. You can switch teams in the waiting lobby while space is available.'}
      </p>
    </fieldset>
  );
}
