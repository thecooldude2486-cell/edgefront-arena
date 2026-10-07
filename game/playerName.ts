// Shared by the menu and server: usernames, not a real-world identity check.
export function playerNameError(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 3 || value.length > 16) return 'Use 3–16 characters.';
  if (!/^[A-Za-z0-9]+$/.test(value)) return 'Use letters and numbers only—no spaces or symbols.';
  if (!/[A-Za-z]/.test(value)) return 'Include at least one letter.';
  return null;
}
