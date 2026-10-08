export function GameHeader({
  compact,
  visible,
  dailyReward,
  onArmory,
  onLevels,
  onCosmetics,
  onCharacter,
}: {
  compact: boolean;
  visible: boolean;
  dailyReward: boolean;
  onArmory: () => void;
  onLevels: () => void;
  onCosmetics: () => void;
  onCharacter: () => void;
}) {
  const items = (
    <div className="quick-menu-items">
      <button onClick={onArmory} aria-keyshortcuts="B">
        <kbd>B</kbd> Armory
      </button>
      <button onClick={onLevels} aria-keyshortcuts="L">
        <kbd>L</kbd> Levels
      </button>
      <button onClick={onCosmetics} aria-keyshortcuts="K">
        <kbd>K</kbd> Cosmetics
      </button>
      <button onClick={onCharacter} aria-keyshortcuts="H">
        <kbd>H</kbd> Character shop{dailyReward ? ' · Reward' : ''}
      </button>
    </div>
  );
  return (
    <header className="game-header">
      <div className="brand-mark">Edgefront</div>
      {visible &&
        (compact ? (
          <details className="game-quick-menu compact-quick-menu">
            <summary>Menu</summary>
            <nav aria-label="Quick access">{items}</nav>
          </details>
        ) : (
          <nav className="game-quick-menu" aria-label="Quick access">
            {items}
          </nav>
        ))}
    </header>
  );
}
