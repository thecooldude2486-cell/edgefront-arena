import { registerHooks } from 'node:module';
// Node 24 can read our shared TypeScript. Resolve the same extensionless
// game imports as Vite, without maintaining a second copy of the arena.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@babylonjs/core/') && !specifier.endsWith('.js')) return next(specifier + '.js', context);
  if (context.parentURL?.includes('/game/') && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
