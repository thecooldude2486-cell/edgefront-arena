// Do not let menus, typed names or settings also operate a weapon.
export function isGameUiInput(target: EventTarget | null) {
  return (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    !!target.closest(
      'input, textarea, select, button, a, summary, dialog, [role="dialog"], [contenteditable="true"]',
    )
  );
}
