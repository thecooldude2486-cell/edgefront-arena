import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = new URL('../', import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/'))
      specifier = new URL(specifier.slice(2), root).href;
    if (specifier.startsWith('.') || specifier.startsWith('file:')) {
      const url = new URL(specifier, context.parentURL);
      if (!/\.[a-z]+$/i.test(url.pathname)) {
        for (const suffix of ['.ts', '.tsx', '.js']) {
          if (existsSync(fileURLToPath(url) + suffix)) {
            specifier = url.href + suffix;
            break;
          }
        }
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.css'))
      return { format: 'module', source: '', shortCircuit: true };
    if (url.endsWith('.tsx'))
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
          },
        }).outputText,
      };
    return next(url, context);
  },
});
const { LoadoutWeaponChoices } =
  await import('../components/LoadoutWeaponChoices.tsx');
const { WEAPON_SLOTS, weaponSlot } = await import('../game/loadoutCatalog.ts');
const { WEAPON_DEFINITIONS } = await import('../game/weaponDefinitions.ts');
const { createOrbWallet, WALLET_STORAGE_KEY, MOLOTOV_PRICE } =
  await import('../game/createOrbWallet.ts');
const catalog = WEAPON_SLOTS.flatMap((slot) => slot.weapons);
assert.deepEqual(
  [...catalog].sort(),
  Object.keys(WEAPON_DEFINITIONS).sort(),
  'Every weapon appears in exactly one slot.',
);
assert.equal(new Set(catalog).size, 10);
assert.equal(weaponSlot('molotov'), 3);

let chosen = null;
const props = {
  slot: 0,
  available: ['assaultRifle', 'sniper'],
  equipped: 'assaultRifle',
  ready: false,
  progress: { laserPartsCount: 3, orbClicks: 8 },
  onChoose: (id) => {
    chosen = id;
  },
};
const primary = renderToStaticMarkup(
  createElement(LoadoutWeaponChoices, props),
);
for (const name of [
  'Kestrel AR',
  'Meridian Sniper',
  'Comet Launcher',
  'Helion',
])
  assert.ok(
    primary.includes(name),
    name + ' remains discoverable on a production wallet.',
  );
assert.equal((primary.match(/<button/g) || []).length, 4);
assert.match(primary, /500 Orbs/);
assert.match(primary, /Find lobby parts · 3\/5/);
const primaryButtons = LoadoutWeaponChoices(props).props.children;
assert.deepEqual(
  primaryButtons.map((button) => button.props.disabled),
  [false, false, true, true],
);
primaryButtons[2].props.onClick();
assert.equal(
  chosen,
  null,
  'Browsing the catalog cannot equip a locked primary.',
);
primaryButtons[1].props.onClick();
assert.equal(chosen, 'sniper');

const saved = new Map([
  [
    WALLET_STORAGE_KEY,
    JSON.stringify({ orbs: MOLOTOV_PRICE, sniperOwned: true }),
  ],
]);
const storage = {
  getItem: (key) => saved.get(key),
  setItem: (key, value) => saved.set(key, value),
};
const wallet = createOrbWallet(storage);
const original = saved.get(WALLET_STORAGE_KEY);
const utilityProps = {
  ...props,
  slot: 3,
  available: ['grenade'],
  equipped: 'grenade',
};
const utility = renderToStaticMarkup(
  createElement(LoadoutWeaponChoices, utilityProps),
);
assert.match(utility, /Pulse Grenade/);
assert.match(utility, /Ember Molotov/);
assert.match(utility, /Locked · Unlock in Armory · 250 Orbs/);
LoadoutWeaponChoices(utilityProps).props.children[1].props.onClick();
assert.equal(chosen, 'sniper', 'The locked Molotov cannot be equipped.');
assert.equal(
  saved.get(WALLET_STORAGE_KEY),
  original,
  'Viewing locked gear never edits ownership or Orbs.',
);
assert.equal(wallet.buyMolotov(), 'purchased');
assert.equal(wallet.state.orbs, 0);
assert.equal(createOrbWallet(storage).state.molotovOwned, true);
const ownedProps = {
  ...utilityProps,
  available: ['grenade', 'molotov'],
  equipped: 'molotov',
};
const owned = renderToStaticMarkup(
  createElement(LoadoutWeaponChoices, ownedProps),
);
assert.doesNotMatch(owned, /Locked/);
LoadoutWeaponChoices(ownedProps).props.children[1].props.onClick();
assert.equal(chosen, 'molotov', 'A saved purchase makes Molotov selectable.');
chosen = null;
for (const button of LoadoutWeaponChoices({ ...ownedProps, ready: true }).props
  .children) {
  assert.equal(button.props.disabled, true);
  button.props.onClick();
}
assert.equal(
  chosen,
  null,
  'Ready locks every choice throughout the shared countdown.',
);
console.log(
  'PASS: every weapon remains visible on production wallets, four primary cards and Ember Molotov, real unlock costs/progress, locked selection guards, saved Molotov purchase and Ready locks.',
);
