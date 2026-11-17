"use client";

import { useEffect, useRef } from "react";

// Polished metal as a single twisting ribbon with nothing behind it: a wavy centre line whose width narrows as it turns
// over, lit like studio strip lights.
const RIBBON = `
precision highp float;
uniform vec2 r; uniform float t; uniform vec2 m;
void main() {
  float x = gl_FragCoord.x / r.y, y = gl_FragCoord.y / r.y * 2. - 1.;
  float ph = x * 1.15 - t * .45 + m.x * 1.2;
  float c = .34 * sin(ph) + .1 * sin(ph * 2.1 + t * .3) + m.y * .2;
  float tw = x * .8 + t * .3, face = cos(tw);
  float w = .3 * abs(face) + .035;
  float d = (y - c) / w;
  float alpha = 1. - smoothstep(1. - 2.5 / (r.y * w), 1., abs(d));
  vec3 n = normalize(vec3(-cos(ph) * .45, sin(tw) * sign(face) * .9 + d * .3, abs(face) + .2));
  vec3 rd = reflect(vec3(0., 0., -1.), n);
  float bands = .5 + .5 * sin(rd.y * 7. + rd.x * 3. + 1.2);
  float col = mix(.45, 1., pow(bands, 1.2)) * mix(.72, 1., smoothstep(-.5, .8, rd.y));
  col *= mix(.8, 1., step(0., face)) * (1. - .22 * pow(abs(d), 6.));
  gl_FragColor = vec4(vec3(col) * vec3(.965, .975, 1.) * alpha, alpha);
}`;

/** A flowing silver ribbon, drawn live. It follows the pointer a little, pauses off screen, and holds still for reduced motion. */
export function Silver() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", { antialias: false, powerPreference: "low-power" });
    if (!canvas || !gl) return; // The CSS gradient behind the canvas stays as the fallback.

    const program = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"], [gl.FRAGMENT_SHADER, RIBBON]] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.bindAttribLocation(program, 0, "p");
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const size = gl.getUniformLocation(program, "r");
    const time = gl.getUniformLocation(program, "t");
    const pointer = gl.getUniformLocation(program, "m");

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0, visible = false, targetX = 0, targetY = 0, x = 0, y = 0;
    const draw = (ms: number) => {
      const scale = Math.min(devicePixelRatio, 1.5);
      const width = Math.round(canvas.clientWidth * scale), height = Math.round(canvas.clientHeight * scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      x += (targetX - x) * .05;
      y += (targetY - y) * .05;
      gl.uniform2f(size, width, height);
      gl.uniform1f(time, ms / 1000);
      gl.uniform2f(pointer, x, y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame = visible && !still ? requestAnimationFrame(draw) : 0;
    };
    const watcher = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(draw);
    });
    watcher.observe(canvas);
    const move = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      const clamp = (value: number) => Math.max(-.5, Math.min(.5, value));
      targetX = clamp((event.clientX - box.left) / box.width - .5);
      targetY = clamp(.5 - (event.clientY - box.top) / box.height);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      watcher.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
    };
  }, []);

  return <canvas ref={ref} className="silver" aria-hidden="true" />;
}
