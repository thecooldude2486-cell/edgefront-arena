import assert from 'node:assert/strict';
import { playerNameError } from '../game/playerName.ts';
for (const name of ['theopgamer','Alex','Player42','123Theo','abcdefghijklmnop']) assert.equal(playerNameError(name),null,name);
for (const name of ['', ' ', '   ', 'ab', 'abcdefghijklmnopq', 'Theo Gamer', ' Theo', 'Theo ', 'Theo_Gamer', 'Theo!', '<script>', '1234', 'Theo\n', 'Theo\t', 'Théo', 'Theo😀', 'Theo\u200b', null, 123]) assert.ok(playerNameError(name),String(name));
console.log('PASS: usernames accepted; empty, whitespace, symbols, numeric-only, hidden characters and invalid lengths rejected.');
