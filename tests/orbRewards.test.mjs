import assert from 'node:assert/strict';
import { createOrbRewards, DIFFICULTY_ORB_REWARDS } from '../game/createOrbRewards.ts';
for (const [difficulty, rewards] of Object.entries(DIFFICULTY_ORB_REWARDS)) {
  const tracker = createOrbRewards(); let total = 0;
  tracker.update({playerScore: 0, result: 'none'}, difficulty);
  for (let score = 1; score <= 5; score++) {
    const earned = tracker.update({playerScore: score}, difficulty);
    assert.equal(earned, rewards.roundWin); total += earned;
    assert.equal(tracker.update({playerScore: score}, difficulty), 0);
  }
  total += tracker.update({result: 'victory'}, difficulty);
  assert.equal(total, rewards.roundWin * 5 + rewards.matchWin);
  assert.equal(tracker.update({result: 'victory'}, difficulty), 0);
  tracker.update({playerScore: 0, result: 'none'}, difficulty);
  assert.equal(tracker.update({playerScore: 1}, difficulty), rewards.roundWin);
  assert.equal(tracker.update({result: 'defeat'}, difficulty), 0);
}
console.log('PASS: all difficulty payouts, victory totals, no duplicate awards, defeat and replay.');
