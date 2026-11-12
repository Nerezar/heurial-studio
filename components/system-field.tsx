"use client";

import { useEffect, useRef } from "react";

/*
 * Homepage hero visual: messy work becoming a workflow.
 * Tangled lines on the left (scattered tasks) are combed into neat parallel lanes
 * as they pass a checkpoint. Small dots travel along them: grey and loose before
 * the checkpoint, blue with a short trail after it.
 *
 * Built to stay smooth: the lines are drawn once to an offscreen layer and only
 * the moving dots are drawn each frame. Design space is 850×516.
 */

const W = 850;
const H = 516;
const LINES = 13;
const GAP = 17;
const CY = 262;
const START_X = 20;
const GATE_X = 470;
const END_X = 846;
const SAMPLES = 420;
const MAX_DOTS = 26;
const INTRO = 1.6;

type Line = { xs: Float32Array; ys: Float32Array; gateAt: number };
type Dot = { line: number; s: number; speed: number; age: number };

// Small seeded random so the tangle looks the same on every visit.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const smooth = (v: number) => v * v * (3 - 2 * v);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function buildLines(): Line[] {
  const rand = seeded(7);
  return Array.from({ length: LINES }, (_, i) => {
    const laneY = CY + (i - (LINES - 1) / 2) * GAP;
    const startY = 40 + rand() * (H - 80);
    const amp = 18 + rand() * 46;
    const freq = .012 + rand() * .018;
    const phase = rand() * Math.PI * 2;
    const yAt = (x: number) => {
      if (x >= GATE_X) return laneY;
      const k = smooth(clamp01((x - START_X) / (GATE_X - 60 - START_X)));
      const wobble = amp * (1 - k) * Math.sin(x * freq + phase) * (1 - smooth(clamp01((x - (GATE_X - 120)) / 120)));
      return startY + (laneY - startY) * k + wobble;
    };
    // Sample densely, then resample by arc length so dots move at an even pace.
    const dense = 1600;
    const px: number[] = [];
    const py: number[] = [];
    const len: number[] = [0];
    for (let j = 0; j <= dense; j++) {
      const x = START_X + (END_X - START_X) * (j / dense);
      px.push(x);
      py.push(yAt(x));
      if (j) len.push(len[j - 1] + Math.hypot(x - px[j - 1], py[j] - py[j - 1]));
    }
    const total = len[dense];
    const xs = new Float32Array(SAMPLES + 1);
    const ys = new Float32Array(SAMPLES + 1);
    let gateAt = 0;
    for (let k = 0, j = 0; k <= SAMPLES; k++) {
      const target = (k / SAMPLES) * total;
      while (j < dense - 1 && len[j + 1] < target) j++;
      const f = (target - len[j]) / Math.max(1e-6, len[j + 1] - len[j]);
      xs[k] = px[j] + (px[j + 1] - px[j]) * f;
      ys[k] = py[j] + (py[j + 1] - py[j]) * f;
      if (!gateAt && xs[k] >= GATE_X) gateAt = k / SAMPLES;
    }
    return { xs, ys, gateAt };
  });
}

function pointAt(line: Line, s: number) {
  const f = clamp01(s) * SAMPLES;
  const i = Math.min(SAMPLES - 1, Math.floor(f));
  const t = f - i;
  return { x: line.xs[i] + (line.xs[i + 1] - line.xs[i]) * t, y: line.ys[i] + (line.ys[i + 1] - line.ys[i]) * t };
}

// Fade in from the left edge and out at the right, baked into everything drawn.
const edgeFade = (x: number) => smooth(clamp01((x - START_X) / 150)) * (1 - smooth(clamp01((x - (END_X - 70)) / 70)));

export function SystemField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lines = buildLines();
    const layer = document.createElement("canvas");
    const lctx = layer.getContext("2d")!;
    let dpr = 1;

    // The still part of the picture: guides, tangled lines, lanes and the checkpoint.
    function paintLayer() {
      layer.width = canvas!.width;
      layer.height = canvas!.height;
      lctx.setTransform(canvas!.width / W, 0, 0, canvas!.height / H, 0, 0);
      lctx.clearRect(0, 0, W, H);
      lctx.lineCap = "round";
      lctx.lineJoin = "round";

      // Faint horizontal guides.
      lctx.strokeStyle = "rgba(145,182,255,.07)";
      lctx.lineWidth = .75;
      lctx.beginPath();
      for (let y = 46; y < H; y += 42) { lctx.moveTo(0, y); lctx.lineTo(W, y); }
      lctx.stroke();

      for (const [index, line] of lines.entries()) {
        const signal = index === 3 || index === 9;
        // Before the checkpoint: loose grey.
        lctx.beginPath();
        let k = 0;
        lctx.moveTo(line.xs[0], line.ys[0]);
        for (k = 1; line.xs[k] < GATE_X && k <= SAMPLES; k++) lctx.lineTo(line.xs[k], line.ys[k]);
        lctx.strokeStyle = "rgba(180,184,193,.5)";
        lctx.lineWidth = .9;
        lctx.stroke();
        // After: ordered lanes, two of them in signal blue.
        lctx.beginPath();
        lctx.moveTo(GATE_X, line.ys[k]);
        lctx.lineTo(END_X, line.ys[k]);
        lctx.strokeStyle = signal ? "rgba(120,160,245,1)" : "rgba(96,141,235,.5)";
        lctx.lineWidth = signal ? 1.4 : .9;
        lctx.stroke();
      }

      // The checkpoint: a bracket across the lanes.
      const top = CY - ((LINES - 1) / 2) * GAP - 14;
      const bottom = CY + ((LINES - 1) / 2) * GAP + 14;
      lctx.strokeStyle = "#7d8694";
      lctx.lineWidth = 1;
      lctx.beginPath();
      lctx.moveTo(GATE_X - 8, top); lctx.lineTo(GATE_X, top); lctx.lineTo(GATE_X, bottom); lctx.lineTo(GATE_X - 8, bottom);
      lctx.moveTo(GATE_X, top - 26); lctx.lineTo(GATE_X, top - 8);
      lctx.moveTo(GATE_X, bottom + 8); lctx.lineTo(GATE_X, bottom + 26);
      lctx.stroke();

      // Bake the left and right fade into the layer.
      lctx.globalCompositeOperation = "destination-in";
      const fade = lctx.createLinearGradient(0, 0, W, 0);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(150 / W, "rgba(0,0,0,1)");
      fade.addColorStop((END_X - 70) / W, "rgba(0,0,0,1)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = fade;
      lctx.fillRect(0, 0, W, H);
      lctx.globalCompositeOperation = "source-over";
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth || W;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(width * (H / W) * dpr);
      paintLayer();
    };

    const dots: Dot[] = [];
    const flashes = new Float32Array(LINES);
    let spawnTimer = 0;
    const rand = seeded(42);
    const addDot = (s = 0) => {
      // Keep a dot from starting right on top of another on the same line.
      let line = Math.floor(rand() * LINES);
      for (let tries = 0; tries < 4 && dots.some((d) => d.line === line && d.s < .08); tries++) line = Math.floor(rand() * LINES);
      dots.push({ line, s, speed: .085 + rand() * .035, age: 0 });
    };

    function draw(t: number) {
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      const reveal = reduced ? 1 : smooth(clamp01(t / INTRO));
      if (reveal > 0) {
        const sw = Math.max(1, Math.round(w * reveal));
        ctx!.drawImage(layer, 0, 0, sw, h, 0, 0, sw, h);
      }
      ctx!.setTransform(w / W, 0, 0, h / H, 0, 0);

      // Checkpoint marks light up as dots pass through them.
      for (let i = 0; i < LINES; i++) {
        const y = CY + (i - (LINES - 1) / 2) * GAP;
        ctx!.globalAlpha = (.35 + flashes[i] * .65) * reveal;
        ctx!.fillStyle = flashes[i] > .05 ? "#c2d5ff" : "#4a5260";
        ctx!.fillRect(GATE_X - 2.5, y - 2.5, 5, 5);
      }

      for (const dot of dots) {
        const line = lines[dot.line];
        const head = pointAt(line, dot.s);
        const alpha = edgeFade(head.x) * Math.min(1, dot.age * 3);
        if (alpha <= .01) continue;
        const past = dot.s > line.gateAt;
        if (past) {
          // A short trail behind the dot, fading out.
          const tail = pointAt(line, Math.max(line.gateAt, dot.s - .09));
          const trail = ctx!.createLinearGradient(tail.x, tail.y, head.x, head.y);
          trail.addColorStop(0, "rgba(96,141,235,0)");
          trail.addColorStop(1, "rgba(160,192,255,.9)");
          ctx!.globalAlpha = alpha;
          ctx!.strokeStyle = trail;
          ctx!.lineWidth = 2;
          ctx!.beginPath(); ctx!.moveTo(tail.x, tail.y); ctx!.lineTo(head.x, head.y); ctx!.stroke();
          ctx!.fillStyle = "#eef3ff";
          ctx!.beginPath(); ctx!.arc(head.x, head.y, 2.4, 0, Math.PI * 2); ctx!.fill();
        } else {
          ctx!.globalAlpha = alpha * .9;
          ctx!.fillStyle = "#b4b8c1";
          ctx!.beginPath(); ctx!.arc(head.x, head.y, 2, 0, Math.PI * 2); ctx!.fill();
          ctx!.globalAlpha = alpha * .3;
          ctx!.strokeStyle = "#9b9fa7";
          ctx!.lineWidth = .75;
          ctx!.beginPath(); ctx!.arc(head.x, head.y, 5, 0, Math.PI * 2); ctx!.stroke();
        }
      }
      ctx!.globalAlpha = 1;
    }

    function step(dt: number, t: number) {
      for (let i = 0; i < LINES; i++) flashes[i] = Math.max(0, flashes[i] - dt * 1.6);
      if (t < INTRO * .7) return;
      spawnTimer -= dt;
      if (spawnTimer <= 0 && dots.length < MAX_DOTS) { addDot(); spawnTimer = .38 + rand() * .3; }
      for (let i = dots.length - 1; i >= 0; i--) {
        const dot = dots[i];
        const line = lines[dot.line];
        const before = dot.s <= line.gateAt;
        // Loose work ambles; once it's through the checkpoint it moves steadily and a little faster.
        dot.s += dot.speed * (before ? 1 : 1.25) * dt;
        dot.age += dt;
        if (before && dot.s > line.gateAt) flashes[dot.line] = 1;
        if (dot.s >= 1) dots.splice(i, 1);
      }
    }

    resize();
    const resizeObserver = new ResizeObserver(() => { resize(); if (reduced) draw(INTRO); });
    resizeObserver.observe(canvas);

    if (reduced) {
      for (let i = 0; i < 16; i++) { addDot(rand()); dots[i].age = 1; }
      draw(INTRO);
      return () => resizeObserver.disconnect();
    }

    // Start with a few dots already on their way so the scene never looks empty.
    for (let i = 0; i < 10; i++) { addDot(.15 + rand() * .75); }

    let frame = 0;
    let visible = true;
    let clock = 0;
    let last = 0;
    const loop = (now: number) => {
      const dt = last ? Math.min(.034, (now - last) / 1000) : 0;
      last = now;
      clock += dt;
      step(dt, clock);
      draw(clock);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (frame || !visible || document.hidden) return;
      last = 0;
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
    };
  }, []);

  return <canvas ref={canvasRef} className="field-canvas" aria-hidden="true" />;
}
