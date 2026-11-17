"use client";

import { useEffect, useRef } from "react";

// A slow height field made of layered waves, lit like polished metal under studio strip lights.
const FRAGMENT = `
precision highp float;
uniform vec2 r; uniform float t; uniform vec2 m;
float h(vec2 p) {
  p += .3 * vec2(sin(p.y * 1.3 + t * .5), cos(p.x * 1.1 - t * .4));
  float v = sin(p.x * 1.5 + t * .55 + sin(p.y * 1.2 - t * .3) * 1.5);
  v += .6 * sin(p.y * 2.2 - t * .4 + sin(p.x * 1.6 + t * .25) * 1.7);
  v += .3 * sin((p.x + p.y) * 2.9 + t * .6);
  return v;
}
void main() {
  vec2 p = (gl_FragCoord.xy - .5 * r) / r.y * vec2(.75, 1.5) + m * .6;
  float e = .012, a = h(p);
  vec3 n = normalize(vec3(h(p + vec2(e, 0.)) - a, h(p + vec2(0., e)) - a, e * 4.2));
  vec3 d = reflect(vec3(0., 0., -1.), n);
  float bands = .5 + .5 * sin(d.y * 9. + d.x * 3. + 1.2);
  float c = mix(.4, 1., pow(bands, 1.25)) * mix(.74, 1., smoothstep(-.4, .8, d.y));
  c += .35 * pow(max(dot(n, normalize(vec3(.4, .6, .7))), 0.), 48.);
  gl_FragColor = vec4(vec3(c) * vec3(.965, .975, 1.), 1.);
}`;

/** Flowing silver, drawn live. It follows the pointer a little, pauses off screen, and holds still for reduced motion. */
export function Silver() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", { antialias: false, powerPreference: "low-power" });
    if (!canvas || !gl) return; // The CSS gradient behind the canvas stays as the fallback.

    const program = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
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
      targetX = (event.clientX - box.left) / box.width - .5;
      targetY = .5 - (event.clientY - box.top) / box.height;
    };
    canvas.addEventListener("pointermove", move);
    return () => {
      watcher.disconnect();
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointermove", move);
    };
  }, []);

  return <canvas ref={ref} className="silver" aria-hidden="true" />;
}
