import assert from 'node:assert/strict';
import { NullEngine, Scene, TransformNode, MeshBuilder, Vector3 } from '@babylonjs/core';
import { classifyBotHit } from '../game/headshots.ts';
const engine = new NullEngine(), scene = new Scene(engine);
const root = new TransformNode('rook', scene);
const head = MeshBuilder.CreateSphere('head', {}, scene); head.parent = root; head.metadata = {hitZone: 'head'};
function hit(x,y,z) { return classifyBotHit(head, Vector3.TransformCoordinates(new Vector3(x,y,z), root.computeWorldMatrix(true))); }
assert.equal(hit(0, 1.2, -.3), 'head');
assert.equal(hit(0, 1.0, -.2), 'body', 'neck/lower helmet is not a headshot');
assert.equal(hit(.25, 1.2, 0), 'body', 'outer helmet edge is not a headshot');
root.position.set(4, 2, -9); root.rotation.y = 1.2;
assert.equal(hit(0, 1.2, -.3), 'head', 'moving/turning preserves head region');
assert.equal(hit(0, 1.0, -.2), 'body');
head.metadata.hitZone = 'body'; assert.equal(hit(0, 1.2, -.3), 'body');
scene.dispose(); engine.dispose();
console.log('PASS: head centre, neck exclusion, tighter sides, moved/rotated bot and body hits.');
