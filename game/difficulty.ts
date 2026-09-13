// Rook behaviour only. Health, weapon damage and player movement never change.
export const DIFFICULTIES = {
  easy: { label: 'Easy', description: 'Relaxed practice. Slow reactions, loose aim and gentle movement.', reactionMs: 1200, shotMs: 850, jitterMs: 350, spread: 1.5, moveSpeed: 2, patrolSpeed: 1.8, color: '#b9f465' },
  normal: { label: 'Normal', description: 'Classic Rook. Balanced movement, forgiving aim and steady pressure.', reactionMs: 650, shotMs: 520, jitterMs: 260, spread: 1, moveSpeed: 2.8, patrolSpeed: 2.15, color: '#35d5ea' },
  hard: { label: 'Hard', description: 'Sharper aim, faster reactions and more frequent shots. Use cover.', reactionMs: 400, shotMs: 360, jitterMs: 150, spread: .8, moveSpeed: 3.3, patrolSpeed: 2.5, color: '#ffc46b' },
  extreme: { label: 'Extreme', description: 'Precise aim and aggressive movement. Very little time in the open.', reactionMs: 240, shotMs: 240, jitterMs: 100, spread: .6, moveSpeed: 3.8, patrolSpeed: 2.9, color: '#ff6f6a' },
  nightmare: { label: 'Nightmare', description: 'Relentless pressure. Near-instant reactions and deadly accuracy—not perfect aim.', reactionMs: 150, shotMs: 160, jitterMs: 60, spread: .45, moveSpeed: 4.3, patrolSpeed: 3.2, color: '#ba8cff' },
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;
