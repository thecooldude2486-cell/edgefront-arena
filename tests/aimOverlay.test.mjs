import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render the actual shared HUD component without needing a WebGL browser.
const source = await readFile(new URL('../components/AimOverlay.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
}).outputText.replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')));
const { AimOverlay } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const aimed = renderToStaticMarkup(createElement(AimOverlay, { scoped: true }));
assert.match(aimed, /class="sniper-scope-lens"/);
assert.match(aimed, /class="crosshair scope-hidden"/);
const normal = renderToStaticMarkup(createElement(AimOverlay, { scoped: false }));
assert.doesNotMatch(normal, /sniper-scope|scope-hidden/);
assert.match(normal, /class="crosshair /);
for (const file of ['GameShell', 'OnlineRooms']) {
  const hud = await readFile(new URL(`../components/${file}.tsx`, import.meta.url), 'utf8');
  assert.match(hud, /<AimOverlay scoped=\{(?:hud|ammo)\.scoped\}/, `${file} uses real weapon scope state`);
}
console.log('PASS: both HUDs share the normal scope; aiming hides the crosshair, unscoping restores it.');
