import assert from 'node:assert/strict';
import { createTeamRooms } from './teamRooms.mjs';
const teams = createTeamRooms((peer, message) => peer.messages.push(message));
const peer = () => ({ messages: [] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(fn) {
  const end = Date.now() + 2000;
  while (!fn()) {
    if (Date.now() > end) throw Error('Team phase timed out');
    await wait(10);
  }
}
try {
  const peers = Array.from({ length: 4 }, peer);
  teams.handle(peers[0], { type: 'teamCreate', size: 2 });
  const code = peers[0].teamCode;
  for (const p of peers.slice(1)) teams.handle(p, { type: 'teamJoin', code });
  const r = teams.rooms.get(code);
  r.phase = 'intermission';
  r.scores = [1, 0];
  r.deadline = Date.now() + 3000;
  r.combat[2].health = 0;
  r.combat[3].health = 0;
  teams.handle(peers[1], { type: 'teamLeave' });
  assert.deepEqual(
    r.scores,
    [1, 0],
    'Leaving during intermission cannot score the round twice',
  );
  assert.equal(r.phase, 'intermission');
  teams.handle(peers[2], { type: 'teamLeave' });
  teams.handle(peers[3], { type: 'teamLeave' });
  assert.equal(r.phase, 'finished');
  assert.equal(r.winner, 0);
  assert.deepEqual(r.scores, [5, 0], 'The entire absent side forfeits');
  teams.handle(peers[0], { type: 'teamLeave' });
  assert.deepEqual(
    r.scores,
    [5, 0],
    'Leaving a finished match cannot add another point',
  );
  const first = peer(),
    second = peer();
  teams.handle(first, { type: 'teamCreate', size: 1 });
  const waitingCode = first.teamCode;
  teams.handle(second, { type: 'teamJoin', code: waitingCode });
  const lobby = teams.rooms.get(waitingCode);
  assert.equal(lobby.phase, 'voting');
  teams.disconnect(first);
  lobby.disconnected[0] = Date.now() - 1;
  await until(() => lobby.phase === 'waiting' && !lobby.pausedAt);
  assert.equal(lobby.deadline, null);
  assert.equal(
    lobby.tokens[0],
    null,
    'An expired pre-match seat can be filled again',
  );
  const replacement = peer();
  teams.handle(replacement, { type: 'teamJoin', code: waitingCode });
  assert.equal(lobby.phase, 'voting');
  assert.equal(lobby.peers[0], replacement);
  assert.deepEqual(lobby.scores, [0, 0]);
  const host = peer(),
    guest = peer();
  teams.handle(host, { type: 'teamCreate', size: 1 });
  const resumeCode = host.teamCode,
    pending = teams.rooms.get(resumeCode),
    hostToken = pending.tokens[0];
  teams.disconnect(host);
  teams.handle(guest, { type: 'teamJoin', code: resumeCode });
  assert.equal(pending.phase, 'waiting');
  const returned = peer();
  teams.handle(returned, { type: 'teamResume', token: hostToken });
  assert.equal(
    pending.phase,
    'voting',
    'A returning host starts voting if the room filled during their disconnect',
  );
  assert.equal(pending.pausedAt, null);
  console.log(
    'PASS: no extra scores during intermission or after completion, absent-team forfeits, pre-match reconnect expiry returns to waiting and vacant seats can be filled.',
  );
} finally {
  teams.close();
}
