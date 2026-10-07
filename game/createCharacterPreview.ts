import {
  Color4,
  Engine,
  HemisphericLight,
  Scene,
  UniversalCamera,
  Vector3,
} from '@babylonjs/core';
import { createCharacterModel } from './createCharacterModel';
import type { CharacterAppearance } from './storeCatalog';
export function createCharacterPreview(
  canvas: HTMLCanvasElement,
  getAppearance: () => CharacterAppearance,
  makeEngine: (canvas: HTMLCanvasElement) => Engine = (canvas) =>
    new Engine(canvas, true),
) {
  const engine = makeEngine(canvas),
    scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new UniversalCamera(
    'character preview camera',
    new Vector3(1.7, 0.65, 3.4),
    scene,
  );
  camera.minZ = 0.01;
  camera.setTarget(new Vector3(0, 0.05, 0));
  camera.fov = 0.64;
  new HemisphericLight(
    'character preview light',
    new Vector3(0, 1, 1),
    scene,
  ).intensity = 0.95;
  const character = createCharacterModel(scene);
  character.apply(getAppearance());
  let drag: number | null = null;
  const down = (event: PointerEvent) => {
    drag = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (drag === null) return;
    character.root.rotation.y += (event.clientX - drag) * 0.012;
    drag = event.clientX;
  };
  const up = () => {
    drag = null;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  const observer = new ResizeObserver(() => engine.resize());
  observer.observe(canvas);
  engine.runRenderLoop(() => {
    character.apply(getAppearance());
    scene.render();
  });
  return () => {
    observer.disconnect();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    character.dispose();
    scene.dispose();
    engine.dispose();
  };
}
