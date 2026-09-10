import { AbstractMesh, Color3, MeshBuilder, Ray, Scene, TransformNode, UniversalCamera, Vector3 } from '@babylonjs/core';
import { populateOrbiterModel } from './createOrbiterModel';

export const GRAPPLE = { range: 35, throwSpeed: 55, pullSpeed: 16, arrivalDistance: .16 };
export type GrappleState = 'idle' | 'miss' | 'throwing' | 'pulling' | 'clinging' | 'blocked';

// Supplies velocity, never teleports: createGame keeps ownership of collisions.
export function createGrapple(scene: Scene, camera: UniversalCamera, canvas: HTMLCanvasElement,
  player: AbstractMesh, clearance: number, canUse: () => boolean,
  isSurface: (mesh: AbstractMesh) => boolean, onState: (state: GrappleState) => void) {
  const held = new Set<'keyboard' | 'mouse'>();
  let state: GrappleState = 'idle';
  let anchor: Vector3 | null = null;
  let destination = Vector3.Zero();
  let surface: AbstractMesh | null = null;
  let flightStart = Vector3.Zero();
  let flightProgress = 0;
  let blockedTime = 0;
  let previousPosition = player.position.clone();
  const hook = new TransformNode('thrown Orbiter', scene);
  populateOrbiterModel(scene, hook);
  hook.scaling.setAll(.3);
  hook.setEnabled(false);
  const rope = MeshBuilder.CreateLines('Orbiter tether', { points: [Vector3.Zero(), Vector3.Zero()], updatable: true }, scene);
  rope.color = Color3.FromHexString('#c080ff');
  rope.isPickable = false;
  rope.setEnabled(false);

  function setState(next: GrappleState) {
    if (state === next) return;
    state = next;
    onState(next);
  }
  function detach(next: GrappleState = 'idle') {
    anchor = null; surface = null; blockedTime = 0;
    hook.setEnabled(false); rope.setEnabled(false);
    setState(next);
  }
  function cancel() { held.clear(); detach(); }
  function press(source: 'keyboard' | 'mouse') {
    if (!canUse() || document.pointerLockElement !== canvas || held.has(source)) return;
    const alreadyHeld = held.size > 0;
    held.add(source);
    if (alreadyHeld) return;
    // One throw per press; release after a miss before trying again.
    const ray = camera.getForwardRay(GRAPPLE.range);
    const hit = scene.pickWithRay(ray, isSurface);
    if (!hit?.hit || !hit.pickedPoint || !hit.pickedMesh) { detach('miss'); return; }
    const normal = hit.getNormal(true) ?? ray.direction.negate();
    if (Vector3.Dot(normal, ray.direction) > 0) normal.scaleInPlace(-1);
    anchor = hit.pickedPoint.clone();
    surface = hit.pickedMesh;
    // Leave room for the whole standing player outside the wall or ceiling.
    destination = anchor.add(normal.normalize().scale(clearance));
    flightStart = camera.position.clone();
    flightProgress = 0; blockedTime = 0;
    previousPosition.copyFrom(player.position);
    hook.position.copyFrom(flightStart);
    hook.setEnabled(true); rope.setEnabled(true);
    setState('throwing');
  }
  function release(source: 'keyboard' | 'mouse') {
    held.delete(source);
    if (held.size === 0) detach();
  }
  const keyDown = (event: KeyboardEvent) => {
    if (event.code === 'KeyE' && !event.repeat && canUse()) { event.preventDefault(); press('keyboard'); }
  };
  const keyUp = (event: KeyboardEvent) => { if (event.code === 'KeyE') release('keyboard'); };
  const pointerDown = (event: PointerEvent) => { if (event.button === 2) press('mouse'); };
  const pointerUp = (event: PointerEvent) => { if (event.button === 2) release('mouse'); };
  const lockChange = () => { if (document.pointerLockElement !== canvas) cancel(); };
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp);
  window.addEventListener('pointerup', pointerUp); window.addEventListener('blur', cancel);
  canvas.addEventListener('pointerdown', pointerDown); document.addEventListener('pointerlockchange', lockChange);

  return {
    get active() { return anchor !== null; },
    get state() { return state; },
    cancel,
    update(deltaSeconds: number): Vector3 | null {
      if (!canUse() || document.pointerLockElement !== canvas) { cancel(); return null; }
      if (!anchor) return null;
      if (!surface || surface.isDisposed() || !surface.isEnabled()) { cancel(); return null; }
      const toAnchor = anchor.subtract(camera.position);
      if (toAnchor.length() > GRAPPLE.range + 2) { detach('blocked'); return null; }
      const obstruction = scene.pickWithRay(new Ray(camera.position, toAnchor.normalizeToNew(), toAnchor.length()), isSurface);
      if (obstruction?.hit && obstruction.distance < toAnchor.length() - .25) { detach('blocked'); return null; }
      if (state === 'throwing') {
        flightProgress = Math.min(1, flightProgress + deltaSeconds * GRAPPLE.throwSpeed / Math.max(.1, Vector3.Distance(flightStart, anchor)));
        hook.position.copyFrom(Vector3.Lerp(flightStart, anchor, flightProgress));
        hook.rotation.z += deltaSeconds * 14;
        if (flightProgress < 1) return null;
        setState('pulling');
      }
      const difference = destination.subtract(player.position);
      const distance = difference.length();
      if (distance <= GRAPPLE.arrivalDistance) { setState('clinging'); return Vector3.Zero(); }
      if (state === 'clinging') setState('pulling');
      blockedTime = Vector3.Distance(previousPosition, player.position) < .005 ? blockedTime + deltaSeconds : 0;
      previousPosition.copyFrom(player.position);
      if (blockedTime > .6) { detach('blocked'); return null; }
      const speed = Math.min(GRAPPLE.pullSpeed, distance / Math.max(deltaSeconds, .001));
      return difference.normalize().scale(speed);
    },
    draw() {
      if (!anchor) return;
      MeshBuilder.CreateLines('Orbiter tether', { points: [camera.position.add(new Vector3(0, -.2, 0)), hook.position], instance: rope }, scene);
    },
    dispose() {
      cancel();
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp);
      window.removeEventListener('pointerup', pointerUp); window.removeEventListener('blur', cancel);
      canvas.removeEventListener('pointerdown', pointerDown); document.removeEventListener('pointerlockchange', lockChange);
      hook.dispose(false, true); rope.dispose();
    },
  };
}
