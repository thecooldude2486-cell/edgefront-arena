import type { MouseEvent } from 'react';
export function GameHeader({
  compact,
  visible,
  dailyReward,
  onArmory,
  onLevels,
  onCosmetics,
  onCharacter,
  onControls,
  onSettings,
}: {
  compact: boolean;
  visible: boolean;
  dailyReward: boolean;
  onArmory: () => void;
  onLevels: () => void;
  onCosmetics: () => void;
  onCharacter: () => void;
  onControls?: () => void;
  onSettings?: () => void;
}) {
  const choose = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    const menu = event.currentTarget.closest('details');
    if (menu) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
    action();
  };
  const items = (
    <div className="quick-menu-items">
      <button
        onClick={(event) => choose(event, onArmory)}
        aria-keyshortcuts="B"
      >
        <kbd>B</kbd> Armory
      </button>
      {onControls && (
        <button
          onClick={(event) => choose(event, onControls)}
          aria-keyshortcuts="F1"
        >
          <kbd>F1</kbd> Controls
        </button>
      )}
      {onSettings && (
        <button
          onClick={(event) => choose(event, onSettings)}
          aria-keyshortcuts="F2"
        >
          <kbd>F2</kbd> Settings
        </button>
      )}
      <button
        onClick={(event) => choose(event, onLevels)}
        aria-keyshortcuts="L"
      >
        <kbd>L</kbd> Levels
      </button>
      <button
        onClick={(event) => choose(event, onCosmetics)}
        aria-keyshortcuts="K"
      >
        <kbd>K</kbd> Cosmetics
      </button>
      <button
        onClick={(event) => choose(event, onCharacter)}
        aria-keyshortcuts="H"
      >
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
