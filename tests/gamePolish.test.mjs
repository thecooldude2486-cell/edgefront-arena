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
    )
    .replaceAll(
      "from 'react'",
      `from ${JSON.stringify(import.meta.resolve('react'))}`,
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );
}
const render = (Component, props) =>
  renderToStaticMarkup(createElement(Component, props));
const { GamePreferencesDialog } = await component('GamePreferencesDialog');
const preferences = {
  sensitivity: 1.25,
  volume: 0,
  graphics: 'high',
  reducedMotion: true,
  saved: true,
};
const settings = render(GamePreferencesDialog, {
  preferences,
  onChange() {},
  onReset() {},
  onClose() {},
  online: true,
});
assert.match(settings, /<dialog/);
assert.match(settings, /Mouse sensitivity/);
assert.match(settings, /1.25/);
assert.match(settings, /Muted/);
assert.match(settings, /value="high" selected=""/);
assert.match(settings, /type="checkbox" checked=""/);
assert.match(settings, /Settings saved on this browser/);
assert.match(settings, /Online matches keep running/);
assert.match(settings, /Close controls and settings/);
const session = render(GamePreferencesDialog, {
  preferences: { ...preferences, saved: false },
  onChange() {},
  onReset() {},
  onClose() {},
});
assert.match(session, /Browser saving is unavailable/);
const controls = render(GamePreferencesDialog, {
  preferences,
  initialSection: 'controls',
  onChange() {},
  onReset() {},
  onClose() {},
});
for (const action of [
  'Sprint',
  'Slide',
  'Reload',
  'Blast jump',
  'Grapple',
  'Controls / settings',
])
  assert.ok(controls.includes(action));
const { MatchSummary } = await component('MatchSummary');
const summary = render(MatchSummary, {
  result: 'victory',
  scores: [5, 3],
  sides: ['Coral team', 'Cyan team'],
  team: 1,
  detail: '5v5 · Nexus',
  onReplay() {},
  onLobby() {},
  onRecap() {},
  replayLabel: 'Rematch & vote',
  waiting: true,
});
assert.match(summary, /Final score: Coral team 5, Cyan team 3/);
assert.match(summary, /data-team="1"/);
assert.match(summary, /Waiting for everyone/);
assert.match(summary, /disabled=""/);
assert.match(summary, /Death recap/);
const defeat = render(MatchSummary, {
  result: 'defeat',
  scores: [2, 5],
  sides: ['You', 'Rook'],
  detail: '1v1 · Quarry',
  onReplay() {},
  onLobby() {},
});
assert.match(defeat, /Defeat/);
assert.match(defeat, /Play again/);
assert.match(defeat, /Final score: You 2, Rook 5/);
const { OnlineAvailability } = await component('OnlineAvailability');
const unavailable = render(OnlineAvailability, {
  status: 'unavailable',
  error: 'No room service is connected.',
  onBots() {},
});
assert.match(unavailable, /No room service is connected/);
assert.match(unavailable, /Play bot training/);
assert.doesNotMatch(unavailable, /Connecting/);
const connected = render(OnlineAvailability, {
  status: 'connected',
  error: '',
  onBots() {},
});
assert.match(connected, /Room server connected/);
assert.doesNotMatch(connected, /Play bot training/);
const { GameStatus } = await component('GameStatus');
const loading = render(GameStatus, {
  status: 'loading',
  error: '',
  onReload() {},
});
assert.match(loading, /Preparing the atrium/);
assert.match(loading, /Loading your arena/);
assert.doesNotMatch(loading, /Reload game/);
const error = render(GameStatus, {
  status: 'error',
  error: 'Renderer details',
  onReload() {},
});
assert.match(error, /Reload game/);
assert.match(error, /Technical details/);
assert.match(error, /Renderer details/);
console.log(
  'PASS: real controls/settings UI, saved/session messages, mute and graphics state, both team result scores, rematch waiting, online fallback and loading/error recovery.',
);
