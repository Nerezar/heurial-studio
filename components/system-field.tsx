"use client";

import { useEffect, useRef } from "react";

/*
 * Homepage hero visual: a wireframe "system" ring.
 * Loose dots (scattered tasks) drift in from around the ring, get pulled onto
 * the blue signal contours, and travel around them as pulses: messy work
 * becoming a flowing workflow. Drawn on a canvas in an 850×516 design space.
 */

const W = 850;
const H = 516;
const CX = 428;
const CY = 247;
const TURN = Math.PI * 2;
const LAT_COUNT = 23;
const RIB_COUNT = 24;
const SIGNAL_TRACKS = [4, 16].map((index) => index * TURN / LAT_COUNT);
const MAX_PULSES = 14;

type Pose = { t: number; spin: number; pitch: number };
type Point = { x: number; y: number; d: number };
type Pulse = { lon: number; track: number; speed: number; age: number; fade: number };
type Inbound = { sx: number; sy: number; bend: number; lon: number; track: number; age: number; duration: number };

function project(lon: number, lat: number, pose: Pose): Point {
  const r = 192 + 54 * Math.cos(lat) + 12 * Math.sin(3 * lon + pose.t * .35);
  const a = lon + pose.spin;
  const x = r * Math.cos(a);
  const y = r * Math.sin(a);
  const h = 51 * Math.sin(lat) + 24 * Math.sin(2 * lon + pose.t * .22);
  const tiltAngle = 1.0 + pose.pitch;
  const c = Math.cos(tiltAngle);
  const s = Math.sin(tiltAngle);
  const tilted = y * c - h * s;
  const depth = y * s + h * c;
  const p = 920 / (920 - depth);
  return {
    x: CX + (x * .96 + tilted * .28) * p,
    y: CY + (tilted * .96 - x * .28) * p,
    d: depth,
  };
}

const easeInOut = (v: number) => v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
const depthBucket = (d: number) => Math.max(0, Math.min(3, Math.floor((d + 260) / 130)));
const BUCKET_ALPHA = [.35, .6, .85, 1];

export function SystemField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let scale = 1;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth || W;
      scale = width / W;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(width * (H / W) * dpr);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    };
    resize();
    const resizeObserver = new ResizeObserver(() => { resize(); if (reduced) draw(0); });
    resizeObserver.observe(canvas);

    // Pointer parallax (the hero field ignores pointer events, so listen on the window).
    let targetSpin = 0;
    let targetPitch = 0;
    let pointerSpin = 0;
    let pointerPitch = 0;
    const onPointer = (event: PointerEvent) => {
      targetSpin = (event.clientX / window.innerWidth - .5) * .22;
      targetPitch = (event.clientY / window.innerHeight - .5) * .1;
    };
    if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    const pulses: Pulse[] = SIGNAL_TRACKS.flatMap((_, track) =>
      [0, 1, 2].map((i) => ({ lon: (i / 3) * TURN + track * .9, track, speed: .32 + i * .05, age: 0, fade: 1 })),
    );
    const inbound: Inbound[] = [];
    let spawnTimer = .8;

    const spawn = (pose: Pose) => {
      const track = Math.random() < .5 ? 0 : 1;
      const angle = Math.random() * TURN;
      const dist = 300 + Math.random() * 120;
      const lon = Math.random() * TURN;
      inbound.push({
        sx: CX + Math.cos(angle) * dist * 1.1,
        sy: CY + Math.sin(angle) * dist * .55,
        bend: (Math.random() - .5) * 160,
        lon: lon - pose.spin,
        track,
        age: 0,
        duration: 2.2 + Math.random() * 1.2,
      });
    };

    const strokeBuckets = (paths: Path2D[], color: string, width: number, alpha: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      paths.forEach((path, b) => { ctx.globalAlpha = alpha * BUCKET_ALPHA[b]; ctx.stroke(path); });
    };


    function draw(t: number) {
      const reveal = reduced ? 1 : easeInOut(Math.min(1, t / 1.8));
      const pose: Pose = { t, spin: t * .05 + pointerSpin, pitch: pointerPitch };
      ctx!.clearRect(0, 0, W, H);
      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";

      // Ground plane and guides.
      ctx!.globalAlpha = 1;
      ctx!.strokeStyle = "#25292f";
      ctx!.lineWidth = .75;
      ctx!.beginPath();
      for (let i = 0; i < 11; i++) {
        const o = i * 40;
        ctx!.moveTo(80 + o, 321 + o * .32); ctx!.lineTo(480 + o, 193 + o * .32);
        ctx!.moveTo(80 + o, 321 - o * .32); ctx!.lineTo(480 + o, 449 - o * .32);
      }
      ctx!.stroke();

      // Wireframe, bucketed by depth so the back of the ring recedes.
      const ribs = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      const contours = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      const signals = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      const segment = (paths: Path2D[], a: Point, b: Point) => {
        const path = paths[depthBucket((a.d + b.d) / 2)];
        path.moveTo(a.x, a.y);
        path.lineTo(b.x, b.y);
      };

      const lonLimit = reveal * TURN;
      for (let r = 0; r < RIB_COUNT; r++) {
        const lon = r * TURN / RIB_COUNT;
        if (lon > lonLimit) break;
        let prev = project(lon, 0, pose);
        for (let i = 1; i <= 26; i++) {
          const next = project(lon, i / 26 * TURN, pose);
          segment(ribs, prev, next);
          prev = next;
        }
      }
      for (let l = 0; l < LAT_COUNT; l++) {
        const lat = l * TURN / LAT_COUNT;
        const target = l === 4 || l === 16 ? signals : contours;
        const steps = Math.max(1, Math.round(88 * reveal));
        let prev = project(0, lat, pose);
        for (let i = 1; i <= steps; i++) {
          const next = project(i / 88 * TURN, lat, pose);
          segment(target, prev, next);
          prev = next;
        }
      }
      strokeBuckets(ribs, "#8e929c", .65, .35);
      strokeBuckets(contours, "#b4b8c1", .75, .48);
      strokeBuckets(signals, "#608deb", 1.2, .95);

      // Crosshairs.
      ctx!.globalAlpha = .9;
      ctx!.strokeStyle = "#626a76";
      ctx!.lineWidth = .75;
      ctx!.beginPath();
      ctx!.moveTo(428, 65); ctx!.lineTo(428, 84); ctx!.moveTo(419, 75); ctx!.lineTo(437, 75);
      ctx!.moveTo(419, 247); ctx!.lineTo(437, 247); ctx!.moveTo(428, 238); ctx!.lineTo(428, 256);
      ctx!.stroke();


      // Pulses travelling along the signal contours.
      if (reveal >= 1) {
        for (const pulse of pulses) {
          const lat = SIGNAL_TRACKS[pulse.track];
          const alpha = Math.min(1, pulse.age * 2) * pulse.fade;
          if (alpha <= 0) continue;
          let prev = project(pulse.lon - .42, lat, pose);
          for (let i = 1; i <= 12; i++) {
            const next = project(pulse.lon - .42 + i / 12 * .42, lat, pose);
            ctx!.globalAlpha = alpha * (i / 12) * .9;
            ctx!.strokeStyle = "#c2d5ff";
            ctx!.lineWidth = 1 + i / 12 * 1.4;
            ctx!.beginPath(); ctx!.moveTo(prev.x, prev.y); ctx!.lineTo(next.x, next.y); ctx!.stroke();
            prev = next;
          }
          const head = prev;
          const glow = ctx!.createRadialGradient(head.x, head.y, 0, head.x, head.y, 12);
          glow.addColorStop(0, "rgba(194,213,255,.85)");
          glow.addColorStop(1, "rgba(96,141,235,0)");
          ctx!.globalAlpha = alpha * (.55 + .45 * BUCKET_ALPHA[depthBucket(head.d)]);
          ctx!.fillStyle = glow;
          ctx!.beginPath(); ctx!.arc(head.x, head.y, 12, 0, TURN); ctx!.fill();
          ctx!.fillStyle = "#eef3ff";
          ctx!.beginPath(); ctx!.arc(head.x, head.y, 1.8, 0, TURN); ctx!.fill();
        }

        // Loose tasks drifting in and snapping onto the ring.
        for (const item of inbound) {
          const progress = Math.min(1, item.age / item.duration);
          const k = easeInOut(progress);
          const end = project(item.lon, SIGNAL_TRACKS[item.track], pose);
          const mx = (item.sx + end.x) / 2 + item.bend;
          const my = (item.sy + end.y) / 2 - item.bend * .4;
          const qx = (1 - k) ** 2 * item.sx + 2 * (1 - k) * k * mx + k * k * end.x;
          const qy = (1 - k) ** 2 * item.sy + 2 * (1 - k) * k * my + k * k * end.y;
          ctx!.globalAlpha = easeOut(Math.min(1, progress * 4)) * .9;
          ctx!.fillStyle = progress > .7 ? "#c2d5ff" : "#9b9fa7";
          ctx!.beginPath(); ctx!.arc(qx, qy, 1.6 + k, 0, TURN); ctx!.fill();
          ctx!.globalAlpha *= .35;
          ctx!.strokeStyle = "#9b9fa7";
          ctx!.lineWidth = .75;
          ctx!.beginPath(); ctx!.arc(qx, qy, 5 + (1 - k) * 4, 0, TURN); ctx!.stroke();
        }
      }
      ctx!.globalAlpha = 1;
    }

    function step(dt: number, t: number) {
      pointerSpin += (targetSpin - pointerSpin) * Math.min(1, dt * 2.5);
      pointerPitch += (targetPitch - pointerPitch) * Math.min(1, dt * 2.5);
      if (t < 1.8) return;
      for (const pulse of pulses) { pulse.lon += pulse.speed * dt; pulse.age += dt; }
      // Retire the oldest pulses when the ring gets busy.
      const live = pulses.filter((p) => p.fade >= 1);
      if (live.length > MAX_PULSES) live.slice(0, live.length - MAX_PULSES).forEach((p) => { p.fade = .999; });
      for (const pulse of pulses) if (pulse.fade < 1) pulse.fade -= dt * .8;
      for (let i = pulses.length - 1; i >= 0; i--) if (pulses[i].fade <= 0) pulses.splice(i, 1);

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn({ t, spin: t * .05 + pointerSpin, pitch: pointerPitch });
        spawnTimer = 1.1 + Math.random() * 1.1;
      }
      for (let i = inbound.length - 1; i >= 0; i--) {
        const item = inbound[i];
        item.age += dt;
        if (item.age >= item.duration) {
          inbound.splice(i, 1);
          pulses.push({ lon: item.lon + .42, track: item.track, speed: .3 + Math.random() * .12, age: .5, fade: 1 });
        }
      }
    }

    if (reduced) {
      draw(0);
      return () => resizeObserver.disconnect();
    }

    let frame = 0;
    let visible = true;
    let clock = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      clock += dt;
      step(dt, clock);
      draw(clock);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (frame || !visible || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    });
    intersection.observe(canvas);
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      intersection.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return <canvas ref={canvasRef} className="field-canvas" aria-hidden="true" />;
}
