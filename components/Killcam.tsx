'use client';
import { useEffect, useRef, useState } from 'react';
import { KILLCAM_SECONDS } from '@/game/teams';
import type { KillReplay } from '@/game/killReplay';
import type { Cosmetics } from '@/game/progression';
import type { CharacterAppearance } from '@/game/storeCatalog';
export function Killcam({
  replay,
  profiles,
  onComplete,
}: {
  replay: KillReplay;
  onComplete?: () => void;
  profiles?: { cosmetics: Cosmetics; character?: CharacterAppearance }[];
}) {
  const complete = useRef(onComplete);
  useEffect(() => {
    complete.current = onComplete;
  }, [onComplete]);
  const canvas = useRef<HTMLCanvasElement>(null),
    seek = useRef(0),
    playing = useRef(true);
  const [failed, setFailed] = useState(false),
    [isPlaying, setIsPlaying] = useState(true),
    [progress, setProgress] = useState(0),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false,
      cleanup: () => void = () => {};
    seek.current = 0;
    playing.current = true;
    void (async () => {
      const [
        B,
        { createArena },
        { createRemotePlayer },
        { WEAPON_DEFINITIONS },
        { createBot },
        { createGrenades },
        { createRockets },
        { createMolotovs },
      ] = await Promise.all([
        import('@babylonjs/core'),
        import('@/game/createArena'),
        import('@/game/createRemotePlayer'),
        import('@/game/weaponDefinitions'),
        import('@/game/createBot'),
        import('@/game/createGrenade'),
        import('@/game/createRockets'),
        import('@/game/createMolotov'),
      ]);
      if (disposed || !canvas.current) return;
      setFailed(false);
      setIsPlaying(true);
      setProgress(0);
      let engine: InstanceType<typeof B.Engine> | null = null;
      try {
        engine = new B.Engine(
          canvas.current,
          true,
          { antialias: true, preserveDrawingBuffer: false },
          false,
        );
        const scene = new B.Scene(engine);
        scene.clearColor = new B.Color4(0.025, 0.07, 0.1, 1);
        const camera = new B.UniversalCamera(
          'killcam follow',
          B.Vector3.Zero(),
          scene,
        );
        camera.minZ = 0.05;
        camera.fov = 0.95;
        new B.HemisphericLight(
          'killcam arena light',
          new B.Vector3(0, 1, 0),
          scene,
        ).intensity = 0.9;
        const key = new B.DirectionalLight(
          'killcam sunlight',
          new B.Vector3(0.4, -1, 0.3),
          scene,
        );
        key.intensity = 0.65;
        const arena = createArena(scene, replay.mapId);
        arena.environment.apply({
          seconds: replay.environmentSeconds,
          barrelHealth: replay.barrelHealth,
        });
        const actors = [0, 1].map((i) => {
          if (replay.botActor !== i) return createRemotePlayer(scene);
          const bot = createBot(scene, camera, {
            onEliminated: () => {},
            onHealthChange: () => {},
            onPlayerHit: () => {},
            isPlayerAlive: () => false,
          });
          bot.root.checkCollisions = false;
          return {
            get projectileTargets() {
              return bot.root
                .getChildMeshes()
                .filter((m) => m.metadata?.owner === 'bot');
            },
            show: (pose: import('@/game/onlineMovement').PlayerPose) => {
              bot.root.position.set(pose.x, pose.y, pose.z);
              bot.root.rotation.y = pose.yaw - Math.PI;
            },
            equip: () => {},
            update: () => {},
            fire: () => {},
            setCosmetics: () => {},
            setCharacterAppearance: () => {},
            dispose: () => bot.dispose(),
          };
        });
        actors.forEach((actor, i) => {
          const profile = profiles?.[i];
          if (profile) {
            actor.setCosmetics(profile.cosmetics);
            if (profile.character)
              actor.setCharacterAppearance(profile.character);
          }
        });
        const grenades = createGrenades(scene, () => {}),
          rockets = createRockets(scene, () => {}),
          molotovs = createMolotovs(scene, () => {});
        const final = replay.frames.at(-1)!;
        const duration = Math.max(0.001, final.at);
        const playbackRate = duration / KILLCAM_SECONDS;
        const traces: { mesh: InstanceType<typeof B.Mesh>; age: number }[] = [];
        let lastTime = -1,
          lastUi = -1;
        const size = new ResizeObserver(() => engine?.resize());
        size.observe(canvas.current);
        engine.runRenderLoop(() => {
          if (disposed) return;
          const elapsedSeconds = Math.max(0, engine!.getDeltaTime() / 1000);
          const dt = Math.min(0.05, elapsedSeconds);
          if (playing.current)
            seek.current = Math.min(
              duration,
              seek.current + elapsedSeconds * playbackRate,
            );
          const time = seek.current;
          let index = replay.frames.findIndex((f) => f.at >= time);
          if (index < 0) index = replay.frames.length - 1;
          const next = replay.frames[index],
            before = replay.frames[Math.max(0, index - 1)];
          const mix =
            next.at === before.at
              ? 1
              : Math.max(
                  0,
                  Math.min(1, (time - before.at) / (next.at - before.at)),
                );
          const poses = next.actors.map((actor, i) => {
            const a = before.actors[i].pose,
              b = actor.pose;
            const yaw =
              a.yaw +
              Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) *
                mix;
            const pose = {
              x: a.x + (b.x - a.x) * mix,
              y: a.y + (b.y - a.y) * mix,
              z: a.z + (b.z - a.z) * mix,
              yaw,
              pitch: a.pitch + (b.pitch - a.pitch) * mix,
            };
            actors[i].show(pose);
            actors[i].equip(actor.weapon);
            actors[i].update(dt);
            return pose;
          });
          const killer = poses[replay.killer],
            victim = poses[1 - replay.killer];
          // Shoulder camera replays real recorded movement, aim and firing events.
          const forward = new B.Vector3(
            Math.sin(killer.yaw),
            0,
            Math.cos(killer.yaw),
          );
          const eye = new B.Vector3(
            killer.x,
            killer.y + 1.55,
            killer.z,
          ).subtract(forward.scale(3.6));
          eye.x += Math.cos(killer.yaw) * 1.3;
          eye.z -= Math.sin(killer.yaw) * 1.3;
          const anchor = new B.Vector3(killer.x, killer.y + 0.7, killer.z),
            delta = eye.subtract(anchor);
          const obstruction = scene.pickWithRay(
            new B.Ray(anchor, delta.normalizeToNew(), delta.length()),
            (m) =>
              m.isEnabled() &&
              m.checkCollisions &&
              !m.metadata?.owner &&
              !m.name.includes('movement collider'),
          );
          camera.position.copyFrom(
            obstruction?.pickedPoint
              ? obstruction.pickedPoint.subtract(
                  delta.normalizeToNew().scale(0.2),
                )
              : eye,
          );
          camera.setTarget(new B.Vector3(victim.x, victim.y + 0.4, victim.z));
          if (time < lastTime) {
            traces.splice(0).forEach((t) => t.mesh.dispose());
            grenades.clear();
            rockets.clear();
            molotovs.clear();
            lastTime = -1;
          }
          for (const frame of replay.frames) {
            if (frame.at <= lastTime || frame.at > time || !frame.shot)
              continue;
            const shot = frame.shot;
            actors[shot.actor].fire(frame.actors[shot.actor].weapon);
            const start = new B.Vector3(
              shot.origin.x,
              shot.origin.y,
              shot.origin.z,
            );
            const direction = new B.Vector3(
              shot.direction.x,
              shot.direction.y,
              shot.direction.z,
            ).normalize();
            const weapon = frame.actors[shot.actor].weapon;
            if (weapon === 'grenade') {
              grenades.throw(
                start,
                direction,
                profiles?.[shot.actor]?.cosmetics,
                false,
              );
              continue;
            }
            if (weapon === 'rocketLauncher') {
              rockets.fire(
                start,
                direction,
                actors[1 - shot.actor].projectileTargets,
                false,
              );
              continue;
            }
            if (weapon === 'molotov') {
              molotovs.throw(start, direction);
              continue;
            }
            const range =
              WEAPON_DEFINITIONS[frame.actors[shot.actor].weapon].range;
            const victimAt = frame.actors[1 - shot.actor].pose;
            const end = start.add(
              direction.scale(
                Math.min(
                  range,
                  Math.hypot(
                    victimAt.x - start.x,
                    victimAt.y - start.y,
                    victimAt.z - start.z,
                  ) + 0.6,
                ),
              ),
            );
            const line = B.MeshBuilder.CreateLines(
              'recorded shot',
              { points: [start, end] },
              scene,
            );
            line.color = B.Color3.FromHexString('#ffaf75');
            line.isPickable = false;
            traces.push({ mesh: line, age: 0 });
          }
          lastTime = time;
          for (const trace of traces.slice()) {
            trace.age += dt;
            trace.mesh.visibility = Math.max(0, 1 - trace.age / 0.22);
            if (trace.age >= 0.22) {
              trace.mesh.dispose();
              traces.splice(traces.indexOf(trace), 1);
            }
          }
          const environmentTime = Math.max(
            0,
            replay.environmentSeconds - duration + time,
          );
          const env = (time >= final.at ? final : before).environment;
          if (env)
            arena.environment.apply(
              { ...env, seconds: environmentTime },
              time >= lastTime,
            );
          arena.environment.update(environmentTime, dt);
          const playbackStep = playing.current
            ? elapsedSeconds * playbackRate
            : 0;
          grenades.update(playbackStep);
          rockets.update(playbackStep);
          molotovs.update(playbackStep);
          if (time === duration && playing.current) {
            playing.current = false;
            setIsPlaying(false);
            queueMicrotask(() => {
              if (!disposed) complete.current?.();
            });
          }
          const rounded = Math.round((time / duration) * 100);
          if (rounded !== lastUi) {
            lastUi = rounded;
            setProgress(rounded);
          }
          scene.render();
        });
        cleanup = () => {
          size.disconnect();
          grenades.dispose();
          rockets.dispose();
          molotovs.dispose();
          actors.forEach((a) => a.dispose());
          arena.dispose();
          scene.dispose();
          engine?.dispose();
        };
        if (disposed) cleanup();
      } catch {
        engine?.dispose();
        if (!disposed) setFailed(true);
      }
    })().catch(() => {
      if (!disposed) setFailed(true);
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [replay, profiles, attempt]);
  return (
    <div className="killcam">
      <div className="killcam-label">
        <span>RECORDED KILLCAM</span>
        <small>3 seconds · shoulder view</small>
      </div>
      {failed ? (
        <p>
          Replay renderer couldn’t start.{' '}
          <button
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          >
            Retry replay
          </button>
        </p>
      ) : (
        <canvas
          ref={canvas}
          aria-label="Animated replay of the last moments before your elimination"
        />
      )}
      <div className="killcam-controls">
        <button
          onClick={() => {
            if (!playing.current && progress === 100) seek.current = 0;
            playing.current = !playing.current;
            setIsPlaying(playing.current);
          }}
        >
          {isPlaying ? 'Pause' : 'Replay'}
        </button>
        <input
          aria-label="Seek death replay"
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => {
            const p = Number(e.target.value);
            seek.current =
              (p / 100) * Math.max(0.001, replay.frames.at(-1)!.at);
            setProgress(p);
          }}
        />
      </div>
    </div>
  );
}
