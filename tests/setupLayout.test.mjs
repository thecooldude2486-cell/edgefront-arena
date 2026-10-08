import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
async function component(file) {
  const source = await readFile(
    new URL(`../components/${file}.tsx`, import.meta.url),
    'utf8',
  );
  const compiled = ts
    .transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replaceAll(
      '"react/jsx-runtime"',
      JSON.stringify(import.meta.resolve('react/jsx-runtime')),
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );
}
const { GameHeader } = await component('GameHeader');
const props = {
  compact: false,
  visible: true,
  dailyReward: true,
  onArmory() {},
  onLevels() {},
  onCosmetics() {},
  onCharacter() {},
};
const setup = renderToStaticMarkup(createElement(GameHeader, props));
assert.match(setup, /<header class="game-header"/);
for (const label of ['Armory', 'Levels', 'Cosmetics', 'Character shop'])
  assert.ok(setup.includes(label));
assert.doesNotMatch(
  setup,
  /<details/,
  'Setup quick access participates in header flow',
);
const match = renderToStaticMarkup(
  createElement(GameHeader, { ...props, compact: true }),
);
assert.match(match, /<details class="game-quick-menu compact-quick-menu">/);
assert.match(match, /<summary>Menu<\/summary>/);
assert.doesNotMatch(
  match,
  /<details[^>]* open/,
  'Match controls stay compact until explicitly expanded',
);
const hidden = renderToStaticMarkup(
  createElement(GameHeader, { ...props, visible: false }),
);
assert.doesNotMatch(hidden, /<button/);
const { TeamPreferencePicker } = await component('TeamPreferencePicker');
const picker = renderToStaticMarkup(
  createElement(TeamPreferencePicker, {
    value: 1,
    onChange() {},
    joining: true,
  }),
);
assert.match(picker, /Team when joining 2v2–5v5/);
assert.match(picker, /aria-pressed="true" class="coral-choice"/);
assert.match(picker, /chosen team is full/);
assert.match(picker, /1v1 assigns opponents automatically/);
for (const team of [0, 1]) {
  const host = renderToStaticMarkup(
    createElement(TeamPreferencePicker, {
      value: team,
      onChange() {},
    }),
  );
  assert.match(host, /Your team as host/);
  assert.match(host, /before creating your room/);
  assert.match(host, /switch teams in the waiting lobby/);
  assert.match(
    host,
    new RegExp(
      `aria-pressed="true" class="${team === 0 ? 'cyan' : 'coral'}-choice"`,
    ),
  );
}
const layout = await readFile(
  new URL('../components/GameLayout.css', import.meta.url),
  'utf8',
);
assert.match(
  layout,
  /grid-template-rows:\s*auto minmax\(0,\s*1fr\)/,
  'Header wrapping automatically reserves its own height',
);
assert.match(
  layout,
  /\.game-shell\.setup-view > \.start-screen\s*\{[^}]*position:\s*relative;[^}]*grid-row:\s*2;/s,
  'Setup content occupies its own scroll region under header',
);
assert.match(
  layout,
  /\.setup-actions \.primary-button\s*\{[^}]*font-size:\s*13px/s,
  'Setup navigation uses compact buttons',
);
console.log(
  'PASS: actual setup/match header rendering, collapsed quick actions, selected online team controls, full-team explanation and flow-separated scrollable setup region.',
);
