import { AbstractMesh, Matrix, Vector3 } from '@babylonjs/core';

// Rook's helmet extends down toward the neck. Only its central upper region
// grants headshot damage; lower helmet/neck and outer edges are body hits.
export function classifyBotHit(mesh: AbstractMesh, worldPoint: Vector3): 'body' | 'head' {
  if (mesh.metadata?.hitZone !== 'head' || !mesh.parent) return 'body';
  const point = Vector3.TransformCoordinates(worldPoint, Matrix.Invert(mesh.parent.getWorldMatrix()));
  return Math.abs(point.x) <= .21 && point.y >= 1.08 && point.y <= 1.46
    ? 'head' : 'body';
}
