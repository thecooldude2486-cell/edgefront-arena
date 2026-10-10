export function GameStatus({
  status,
  error,
  onReload,
}: {
  status: 'loading' | 'error';
  error: string;
  onReload: () => void;
}) {
  return (
    <section className="game-boot-screen" aria-labelledby="boot-title">
      <div className="game-boot-card">
        <p className="eyebrow">EDGEFRONT / ARENA SYSTEMS</p>
        {status === 'loading' ? (
          <>
            <i className="boot-spinner" aria-hidden="true" />
            <h1 id="boot-title">Preparing the atrium</h1>
            <output>Loading your arena, weapons and saved career…</output>
            <small>Your first visit may take a little longer.</small>
          </>
        ) : (
          <>
            <h1 id="boot-title">Let’s get you back in</h1>
            <p role="alert">
              The game could not start. Check your connection, then try again.
            </p>
            <button className="polish-button emphasized" onClick={onReload}>
              Reload game
            </button>
            <details>
              <summary>Technical details</summary>
              <p>{error}</p>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
