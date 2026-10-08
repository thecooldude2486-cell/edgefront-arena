import '../server/gameImports.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

async function component(file, substitutions = {}) {
  let source = await readFile(
    new URL(`../components/${file}.tsx`, import.meta.url),
    'utf8',
  );
  for (const [from, to] of Object.entries(substitutions))
    source = source.replace(from, to);
  const compiled = ts
    .transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(/import ['"]\.\/[^'"]+\.css['"];?/g, '')
    .replaceAll(
      '"react/jsx-runtime"',
      JSON.stringify(import.meta.resolve('react/jsx-runtime')),
    )
    .replaceAll(
      "from 'react'",
      `from ${JSON.stringify(import.meta.resolve('react'))}`,
    )
    .replaceAll(
      "'@/game/weaponDefinitions'",
      JSON.stringify(
        new URL('../game/weaponDefinitions.ts', import.meta.url).href,
      ),
    )
    .replaceAll(
      "'@/game/deathRecap'",
      JSON.stringify(new URL('../game/deathRecap.ts', import.meta.url).href),
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );
}
const { MatchRoster, SpectatorControls } = await component('MatchRoster', {
  "import { LevelBadge } from './Progression';":
    'const LevelBadge = ({level}) => <small>LV {level}</small>;',
});
const players = Array.from({ length: 10 }, (_, slot) => ({
  slot,
  team: slot < 5 ? 0 : 1,
  name: `Player ${slot + 1}`,
  connected: true,
  health: slot === 0 ? 0 : slot === 1 ? 42 : 100,
  weapon: 'assaultRifle',
  kills: slot,
  deaths: 2,
  level: slot + 1,
}));
const spectator = { target: players[1], options: players.slice(1, 5) };
const markup = renderToStaticMarkup(
  createElement(MatchRoster, {
    players,
    localSlot: 0,
    spectator,
    onSelect() {},
  }),
);
assert.equal(
  (markup.match(/class="roster-name"/g) || []).length,
  10,
  'Every player has their own named row',
);
for (const p of players) assert.ok(markup.includes(p.name));
assert.match(markup, /Player 1 \(You\)/);
assert.match(markup, /Eliminated/);
assert.match(markup, /42 HP/);
assert.match(markup, /1K \/ 2D/);
assert.match(markup, /aria-pressed="true"/);
assert.equal(
  (markup.match(/disabled=""/g) || []).length,
  6,
  'Only eligible teammate rows are clickable',
);
for (let size = 2; size <= 5; size++) {
  const bots = Array.from({ length: size * 2 }, (_, slot) => ({
    slot,
    team: slot < size ? 0 : 1,
    name:
      slot === 0
        ? 'Player1'
        : slot < size
          ? `Ally ${slot}`
          : `Rook ${slot - size + 1}`,
    connected: true,
    health: slot === size ? 37 : slot === size + 1 ? 0 : 100,
    weapon: 'assaultRifle',
  }));
  const enemy = renderToStaticMarkup(
    createElement(MatchRoster, {
      players: bots,
      localSlot: 0,
      team: 1,
      opposing: true,
      onSelect() {},
    }),
  );
  assert.equal(
    (enemy.match(/class="roster-name"/g) || []).length,
    size,
    `${size}v${size} shows every opposing bot individually`,
  );
  for (let i = 1; i <= size; i++) assert.ok(enemy.includes(`Rook ${i}`));
  assert.doesNotMatch(enemy, /Ally |Player1|Cyan team/);
  assert.match(enemy, /Opposing team players/);
  assert.match(enemy, /opposing-match-roster/);
  assert.match(enemy, /37 HP/);
  assert.match(enemy, /Eliminated/);
  assert.match(enemy, new RegExp(`${size - 1} alive`));
  const allied = renderToStaticMarkup(
    createElement(MatchRoster, {
      players: bots,
      localSlot: 0,
      team: 0,
      onSelect() {},
    }),
  );
  assert.equal((allied.match(/class="roster-name"/g) || []).length, size);
  assert.match(allied, /Player1 \(You\)/);
  assert.doesNotMatch(allied, /Rook /);
}
const controls = renderToStaticMarkup(
  createElement(SpectatorControls, {
    state: spectator,
    onCycle() {},
    onRecap() {},
    intermission: false,
  }),
);
assert.match(controls, /Player 2/);
assert.match(controls, /Spectate previous player/);
assert.match(controls, /Spectate next player/);
assert.match(controls, /Death recap/);
const empty = renderToStaticMarkup(
  createElement(SpectatorControls, {
    state: { target: null, options: [] },
    onCycle() {},
    intermission: true,
  }),
);
assert.match(empty, /Waiting for the next round/);
assert.equal((empty.match(/disabled=""/g) || []).length, 2);
const { DeathRecap } = await component('DeathRecap', {
  "import { Killcam } from './Killcam';": 'const Killcam = () => null;',
  "import { RarityBadge } from './RarityBadge';":
    'const RarityBadge = () => null;',
});
const { createDeathRecap } = await import('../game/deathRecap.ts');
const log = createDeathRecap();
log.record('sniper', 'head', 100, 0, 25);
const recap = log.read('Player 2', 42, 75);
const closable = renderToStaticMarkup(
  createElement(DeathRecap, { recap, onClose() {} }),
);
assert.match(closable, /aria-label="Close death recap"/);
assert.match(closable, /Close \/ Spectate/);
assert.match(closable, /Eliminated by Player 2/);
assert.match(closable, /Headshot finish/);
const dialogRecap = renderToStaticMarkup(
  createElement(DeathRecap, { recap, onClose() {}, closeLabel: 'Close ×' }),
);
assert.match(dialogRecap, /Close ×/);
console.log(
  'PASS: rendered ten individual rows, health/status/KD, eligible spectator actions, empty waiting state, and visible recap close button with preserved killer stats.',
);
