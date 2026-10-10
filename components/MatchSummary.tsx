export function MatchSummary({
  result,
  scores,
  sides,
  detail,
  onReplay,
  onLobby,
  onRecap,
  replayLabel = 'Play again',
  waiting = false,
  team = 0,
}: {
  result: 'victory' | 'defeat';
  scores: [number, number];
  sides: [string, string];
  detail: string;
  onReplay: () => void;
  onLobby: () => void;
  onRecap?: () => void;
  replayLabel?: string;
  waiting?: boolean;
  team?: number;
}) {
  return (
    <section
      className={`match-result polished-result ${result}`}
      data-team={team}
      aria-labelledby="match-result-title"
    >
      <div className="match-result-card">
        <p>Match complete · First to 5</p>
        <h2 id="match-result-title">
          {result === 'victory' ? 'Victory' : 'Defeat'}
        </h2>
        <div
          className="result-score"
          aria-label={`Final score: ${sides[0]} ${scores[0]}, ${sides[1]} ${scores[1]}`}
        >
          <div>
            <span>{sides[0]}</span>
            <strong>{scores[0]}</strong>
          </div>
          <i aria-hidden="true">:</i>
          <div>
            <span>{sides[1]}</span>
            <strong>{scores[1]}</strong>
          </div>
        </div>
        <p className="result-detail">{detail}</p>
        <div className="result-actions">
          <button
            className="polish-button emphasized"
            disabled={waiting}
            onClick={onReplay}
          >
            {waiting ? 'Waiting for everyone…' : replayLabel}
          </button>
          <button className="polish-button" onClick={onLobby}>
            Return to lobby
          </button>
          {onRecap && (
            <button className="polish-button" onClick={onRecap}>
              Death recap
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
