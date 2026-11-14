"use client";

import { useEffect, useRef } from "react";

// The emblem from public/brand/emblem.svg, split in two so the flame at the mouth can move on its own.
const BODY = "M 183.186 6.167 C 186.278 11.735, 193.766 19.011, 199.767 22.277 C 206.440 25.909, 215.052 27.996, 223.460 28.020 C 241.852 28.073, 252.180 32.025, 262.041 42.785 C 265.426 46.478, 268.661 50.370, 269.230 51.432 L 270.265 53.364 266.883 51.155 C 253.171 42.198, 244.046 38.575, 230.739 36.803 L 221.816 35.615 203.158 36.821 C 168.871 39.036, 153.400 38.126, 138.570 33.024 L 132.941 31.087 138.121 38.581 C 147.703 52.442, 158.858 60.708, 171.910 63.619 C 180.899 65.624, 189.434 65.117, 206.376 61.570 C 223.017 58.086, 232.611 57.502, 243.500 59.307 C 248.450 60.128, 254.997 61.743, 258.049 62.896 C 263.575 64.985, 273.565 70.768, 272.861 71.472 C 272.658 71.676, 268.668 70.691, 263.996 69.283 L 255.500 66.724 242.336 66.249 L 229.173 65.773 218.963 67.959 C 213.348 69.162, 204.196 71.474, 198.627 73.098 C 186.075 76.758, 172.017 78.986, 161.426 78.994 C 153.182 79, 137.965 76.797, 130.280 74.484 C 127.926 73.775, 126 73.403, 126 73.657 C 126 75.089, 133.328 82.830, 139.580 88.001 C 148.013 94.977, 159.016 101.123, 167.500 103.596 C 175.284 105.866, 187.726 105.871, 195.382 103.607 C 198.617 102.650, 207.617 98.548, 215.382 94.490 C 232.648 85.469, 243.819 81.987, 255.362 82.030 C 263.895 82.062, 264.185 83.184, 256 84.496 C 248.234 85.740, 236.129 91.001, 227.148 97.034 C 222.392 100.230, 212.200 108.096, 204.500 114.515 C 184.384 131.284, 179.616 133.411, 152 137.935 C 145.125 139.061, 138.565 140.244, 137.422 140.563 L 135.343 141.143 134.069 132.578 C 131.517 115.424, 122.899 96.393, 112.620 85.214 C 102.732 74.460, 88.367 66.315, 73.500 63.031 C 62.655 60.636, 53.622 60.481, 43.815 62.523 C 33.958 64.576, 27.097 68.090, 19.855 74.795 C 13.302 80.861, 1.327 95, 2.741 95 C 3.220 95, 11.011 93.788, 20.055 92.306 L 36.500 89.612 53.500 89.605 L 70.500 89.598 77.500 91.342 C 91.991 94.951, 104.422 102.700, 112.243 113 C 117.507 119.933, 125.539 135.427, 126.585 140.668 L 127.217 143.836 124.165 145.415 L 121.113 146.993 117.897 140.958 C 116.006 137.410, 111.369 131.612, 106.647 126.890 L 98.615 118.857 89.557 114.462 C 70.878 105.399, 50.344 103.814, 33.353 110.125 L 27.500 112.299 19.450 120.399 C 12.494 127.400, 1.624 141.827, 2.541 142.842 C 2.711 143.029, 8.846 140.923, 16.175 138.162 C 37.002 130.313, 42.917 128.883, 57.037 128.283 L 69.574 127.750 77.882 129.851 C 90.014 132.919, 99.577 137.890, 107.493 145.243 L 114.291 151.558 111.084 155.029 C 109.320 156.938, 105.473 161.911, 102.535 166.080 C 99.597 170.248, 95.807 174.826, 94.113 176.252 C 90.387 179.386, 83.169 182.149, 72.693 184.448 C 63.703 186.421, 60.888 188.479, 52.136 199.471 C 49.058 203.337, 42.168 211.143, 36.826 216.817 C 24.287 230.136, 21.446 235.782, 23.957 242.387 C 25.536 246.540, 29.785 248.003, 40.200 247.978 C 54.809 247.944, 60.961 244.180, 59.558 236.136 C 59.209 234.136, 58.678 230.918, 58.379 228.985 L 57.835 225.470 63.901 218.850 C 74.648 207.121, 82.297 203.668, 100.134 202.495 C 105.835 202.120, 113.475 201.217, 117.110 200.489 C 125.448 198.820, 136.088 193.498, 143.087 187.498 C 151.097 180.629, 160.778 174.509, 167 172.381 L 172.500 170.500 185 170.899 C 191.875 171.119, 202.484 171.344, 208.576 171.399 L 219.651 171.500 223.728 168.801 C 231.182 163.865, 237.167 156.358, 244.695 142.500 C 246.488 139.200, 247.965 136.901, 247.977 137.392 C 247.990 137.883, 247.059 141.483, 245.908 145.392 C 243.095 154.952, 237.630 165.704, 229.631 177.420 L 223 187.132 223 190.844 C 223 195.180, 225.001 198.432, 228.916 200.456 C 232.512 202.316, 245.962 203.995, 257.474 204.020 C 277.372 204.063, 288.561 207.594, 294.042 215.560 C 295.710 217.986, 297.929 220.427, 298.972 220.985 C 300.015 221.543, 303.936 221.990, 307.684 221.978 C 319.044 221.941, 326 217.479, 326 210.228 C 326 205.581, 324.043 202.277, 317.789 196.361 C 308.073 187.173, 304.435 185.987, 283 185.015 C 273.925 184.604, 265.426 183.837, 264.113 183.311 L 261.726 182.354 272.113 179.080 C 277.826 177.278, 288.021 173.567, 294.770 170.832 C 311.608 164.008, 323.758 160, 327.603 160 C 329.443 160, 334.075 161.719, 338.380 164 L 345.929 168 350.579 168 C 356.615 168, 362.407 164.770, 364.579 160.192 L 366.230 156.712 365.116 152.994 C 363.507 147.622, 355.565 140.542, 348.942 138.575 C 346.024 137.709, 342.183 137, 340.406 137 C 335.454 137, 323.562 139.482, 306.754 144.024 C 293.807 147.523, 276.032 151.225, 275.278 150.580 C 275.156 150.475, 276.669 147.995, 278.640 145.068 C 284.477 136.401, 288.362 127.141, 288.821 120.804 C 289.387 112.974, 288.613 110.623, 283.716 105.291 L 279.500 100.700 283.500 101.415 C 289.320 102.454, 294.946 105.401, 299.858 109.981 C 302.231 112.194, 305.262 114.279, 306.593 114.613 C 313.739 116.406, 320.923 111.365, 323.477 102.764 C 324.315 99.944, 325 97.317, 325 96.926 C 325 96.535, 323.330 97.067, 321.289 98.108 C 316.384 100.608, 314.404 100.495, 311.455 97.545 L 309 95.091 309 90.031 L 309 84.971 312.250 81.508 C 314.385 79.233, 317.144 77.619, 320.292 76.804 C 326.335 75.239, 328.320 76.332, 329.010 81.602 L 329.520 85.500 333.010 81.873 C 339.735 74.886, 342.991 69.595, 342.996 65.650 C 343 62.694, 340.487 59.802, 332.190 53.215 C 329.914 51.409, 326.027 46.801, 323.552 42.975 C 318.972 35.895, 317.177 34.368, 299.717 22.701 C 295.436 19.840, 288.492 15.130, 284.285 12.234 C 280.034 9.307, 273.718 6.034, 270.068 4.866 C 260.920 1.938, 245.954 1.414, 228.121 3.399 C 210.351 5.378, 196.369 5.420, 188.500 3.520 C 185.200 2.723, 182.134 2.055, 181.686 2.036 C 181.238 2.016, 181.913 3.875, 183.186 6.167 M 281.500 36.639 C 282.600 37.506, 288.595 40.707, 294.822 43.753 C 301.655 47.095, 306.791 50.278, 307.776 51.782 C 309.604 54.571, 314.607 57, 318.524 57 L 321.113 57 319.307 53.884 C 318.313 52.170, 316.150 49.772, 314.500 48.556 C 311.729 46.512, 282.657 34.960, 280.467 35.032 C 279.935 35.049, 280.400 35.773, 281.500 36.639 M 177.763 180.032 C 167.183 181.816, 157.882 186.309, 149.886 193.499 C 143.893 198.888, 133.029 204.659, 123.500 207.515 L 114.500 210.213 106.861 217.961 C 95.949 229.031, 92.993 233.399, 93.032 238.400 C 93.091 245.999, 96.662 248.029, 109.815 247.944 C 121.116 247.870, 124.941 246.539, 127.484 241.792 L 129.470 238.085 128.149 234.792 C 125.705 228.701, 125.721 228.163, 128.415 225.667 C 130.095 224.110, 134.109 222.466, 139.583 221.093 C 153.147 217.691, 156.302 215.740, 168.984 202.906 C 175.318 196.496, 182.529 190.091, 185.009 188.672 C 188.750 186.532, 197.834 183.003, 203.893 181.336 C 204.659 181.125, 205.109 180.801, 204.893 180.615 C 203.928 179.784, 182.024 179.313, 177.763 180.032";
const WISP = "M 364.472 76.397 C 362.807 77.123, 360.107 79.394, 358.472 81.444 C 349.724 92.416, 345.675 94.980, 337.072 94.994 L 333.643 95 341.444 100.430 C 350.020 106.399, 356.749 108.616, 363.175 107.588 C 368.972 106.661, 372.557 104.550, 380.725 97.253 C 386.108 92.445, 389.396 90.351, 393.617 89.046 C 400.893 86.795, 399.182 85.518, 389 85.602 C 380.660 85.670, 377.694 86.824, 369.778 93.081 C 365.476 96.482, 358.723 99.057, 357.449 97.782 C 356.932 97.265, 361.810 91.298, 366.858 86.273 C 370.753 82.396, 376.377 79.324, 381.734 78.149 L 385.500 77.323 381.500 76.167 C 376.230 74.644, 368.248 74.752, 364.472 76.397";
// Where the flame leaves the mouth, in the emblem's own coordinates (viewBox -5 -5 407 269).
const MOUTH = { x: 334, y: 95 };

// Runs while the page is still being read, so the intro is there from the first paint. It shows once per browser tab,
// never under reduced motion, and stays hidden when scripts are off or anything here fails.
// Phones and tablets (touch, no hover) skip it: on an iPhone a strip of the page showed under the veil, and I could not test a fix.
const SHOW = `(function(s){try{if(sessionStorage.getItem("heurial-intro")||matchMedia("(prefers-reduced-motion: reduce), (hover: none) and (pointer: coarse)").matches)return;sessionStorage.setItem("heurial-intro","1");s.parentElement.previousElementSibling.hidden=false}catch(e){}})(document.currentScript)`;

// Seconds after the tiger has landed.
const IGNITE = .25; // the fire starts
const JET_END = .75; // the tiger stops breathing
const HOLD = .24; // how long a square of text or button burns before it becomes the real thing

const VEIL = "#0b0c0e"; // the page background (--bg)
// The fire is drawn on a grid in the site's blue: solid pixels where it is hottest, code characters as it cools.
const SHADES = ["#f1f6ff", "#a9c8ff", "#3478f6", "#2257c4", "#163a80"];
const LEVELS = [2.2, 1.1, .4, .17, .06]; // the heat a square needs for each shade
const PIXELS = 3; // the first three shades are solid pixels, the rest are characters
const GLYPHS = "{}[]<>/=;:+*01#$";

type Ember = { vx: number; vy: number; age: number; life: number; size: number; to: number };

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, from: number, to: number) => clamp((t - from) / (to - from));
const ease = (x: number) => 1 - (1 - x) ** 3;
const rand = (from: number, to: number) => from + Math.random() * (to - from);

/**
 * Which grid squares the page's own words and buttons cover. The page is already laid out under the veil, so its
 * text is redrawn here, letter by letter where the browser put it, and each square is checked for ink.
 */
function contentMap(cols: number, rows: number, c: number) {
  const S = 3; // samples across one square
  const found = new Uint8Array(cols * rows);
  const sheet = document.createElement("canvas");
  sheet.width = cols * S;
  sheet.height = rows * S;
  const g = sheet.getContext("2d", { willReadFrequently: true });
  if (!g) return found;
  g.scale(S / c, S / c);
  g.textBaseline = "bottom";
  const seen = (box: DOMRect) => box.width > 0 && box.bottom > 0 && box.top < rows * c && box.right > 0 && box.left < cols * c;

  for (const el of document.querySelectorAll("header .button, main .button, main button, header img")) {
    const box = el.getBoundingClientRect();
    if (seen(box) && !el.closest(".intro")) g.fillRect(box.left, box.top, box.width, box.height);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    const text = node.nodeValue ?? "";
    if (!el || !text.trim() || el.closest(".intro, .sr-only, .skip-link, .reveal:not(.is-visible), script, style")) continue;
    range.selectNodeContents(node);
    if (!seen(range.getBoundingClientRect())) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.opacity === "0") continue;
    g.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code <= 32 || (code >= 0xd800 && code <= 0xdfff)) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const box = range.getBoundingClientRect();
      if (seen(box)) g.fillText(style.textTransform === "uppercase" ? text[i].toUpperCase() : text[i], box.left, box.bottom);
    }
  }

  const ink = g.getImageData(0, 0, sheet.width, sheet.height).data;
  for (let j = 0, n = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++, n++) {
      let sum = 0;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) sum += ink[((j * S + y) * sheet.width + i * S + x) * 4 + 3];
      if (sum > S * S * 255 * .07) found[n] = 1; // small text is faint at this size, so a little ink is enough
    }
  }
  return found;
}

/** Plays the intro once and hides it. Returns the clean-up. */
function play(root: HTMLDivElement) {
  // Two layers with the tiger between them: the dark veil underneath, the fire on top.
  const [under, over] = root.querySelectorAll("canvas");
  const tiger = root.querySelector<SVGSVGElement>(".intro-tiger");
  const lit = root.querySelector<SVGElement>(".intro-heat");
  const wisp = root.querySelector<SVGElement>(".intro-wisp");
  const veil = under?.getContext("2d");
  const ctx = over?.getContext("2d");
  // Too late (the stylesheet already faded it out) or no canvas: just get out of the way.
  if (!veil || !ctx || !tiger || !lit || !wisp || getComputedStyle(root).visibility === "hidden") {
    root.hidden = true;
    return;
  }

  const W = window.innerWidth;
  const H = root.offsetHeight; // the overlay's own height: taller than the window on a phone whose browser bars are showing
  // Sharp on ordinary screens, but never more than about six million pixels a layer on very large ones.
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6e6 / (W * H))));
  // One grid square in screen pixels. A whole number, so cleared squares leave no hairlines between them.
  const cell = Math.round(Math.min(Math.max(Math.min(W, H) / 64, 9), 15) * dpr);
  const c = cell / dpr;
  const cols = Math.ceil(W / c);
  const rows = Math.ceil(H / c);
  const gap = Math.round(dpr);
  for (const layer of [under, over]) {
    layer.width = cols * cell;
    layer.height = rows * cell;
    layer.style.width = `${cols * c}px`;
    layer.style.height = `${rows * c}px`;
  }
  veil.fillStyle = VEIL;
  veil.fillRect(0, 0, under.width, under.height);
  // From here the canvas itself is the dark veil, and the stylesheet's own fade-out is switched off.
  root.classList.add("is-live");
  ctx.font = `600 ${Math.round(cell * .92)}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const k = Math.min(W, H * 1.6) / 1200; // one scale for speeds and sizes, so a phone and a desktop look alike
  const heat = new Float32Array(cols * rows);
  const open = new Uint8Array(cols * rows); // squares where the veil is gone and the page shows
  const at = new Float32Array(cols * rows).fill(Infinity); // when the fire reaches each square
  const grain = Float32Array.from({ length: cols * rows }, Math.random);
  const entrance = tiger.getAnimations()[0];
  const embers: Ember[] = [];

  let raf = 0;
  let last = performance.now();
  let t = 0;
  let owed = 0;
  let sent = 0;
  let rush = 1; // drops once the jet is over, so the last of the dark clears quickly however empty the page is
  let fade = 1;
  let skipping = false;
  let mouth: { x: number; y: number } | null = null;
  let content = new Uint8Array(0);
  let targets: number[] = [];

  const skip = () => { skipping = true; };
  const skipOn = ["pointerdown", "keydown", "wheel", "touchmove"] as const;
  const stop = () => {
    cancelAnimationFrame(raf);
    for (const type of skipOn) window.removeEventListener(type, skip);
    window.removeEventListener("resize", resized);
  };
  function finish() {
    root.hidden = true;
    stop();
  }
  // A phone's address bar sliding away changes the height only, and that must not cut the intro short.
  function resized() {
    if (window.innerWidth !== W) finish();
  }

  /** Adds the heat of one ember to the squares under it. */
  const warm = (x: number, y: number, radius: number, amount: number) => {
    const cx = x / c;
    const cy = y / c;
    const size = Math.max(radius / c, .8);
    for (let j = Math.max(0, Math.floor(cy - size)); j <= Math.min(rows - 1, Math.floor(cy + size)); j++) {
      for (let i = Math.max(0, Math.floor(cx - size)); i <= Math.min(cols - 1, Math.floor(cx + size)); i++) {
        const d = Math.hypot(i + .5 - cx, j + .5 - cy) / size;
        if (d < 1) heat[j * cols + i] += amount * (1 - d * d);
      }
    }
  };
  /** The fire passes from a burning square to the one beside it: quickly along words and buttons, slower across empty page. */
  const spread = (from: number, to: number) => {
    const when = at[from] + (content[to] ? .012 + grain[to] * .018 : .03 + grain[to] * .045) * rush;
    if (when < at[to]) at[to] = when;
  };

  const step = (dt: number) => {
    if (skipping) {
      fade -= dt / .2;
      root.style.opacity = String(Math.max(fade, 0));
      if (fade <= 0) return finish();
    }
    if (entrance && entrance.playState !== "finished") return;
    if (!mouth) {
      const box = tiger.getBoundingClientRect();
      mouth = { x: box.left + (MOUTH.x + 5) / 407 * box.width, y: box.top + (MOUTH.y + 5) / 269 * box.height };
      content = contentMap(cols, rows, c);
      for (let n = 0; n < content.length; n++) if (content[n]) targets.push(n);
      // Nothing found to aim at: aim at the middle, and the fire still spreads out from there.
      if (!targets.length) targets = [Math.floor(rows / 2) * cols + Math.floor(cols / 2)];
      targets.sort(() => Math.random() - .5);
    }
    t += dt;

    // The tiger draws back, then lunges as the fire comes.
    const back = ease(span(t, 0, IGNITE));
    const dx = (-10 * back + 16 * ease(span(t, IGNITE, IGNITE + .12))) * Math.max(k, .5);
    const power = span(t, IGNITE, IGNITE + .15) * (1 - span(t, JET_END - .2, JET_END));
    tiger.style.transform = `translateX(${dx}px)`;
    tiger.style.opacity = String(1 - span(t, JET_END, JET_END + .3));
    lit.style.opacity = String(power);
    wisp.style.fill = `color-mix(in srgb, ${SHADES[1]} ${back * 100}%, #c5ced6)`;
    wisp.style.opacity = String(1 - span(t, IGNITE, IGNITE + .12));

    // The jet: each ember leaves the mouth as fire, then bends towards one square of the page's text or buttons.
    const drag = 3.2;
    owed += power * 560 * dt;
    for (; owed >= 1; owed--) {
      const to = targets[sent++ % targets.length]; // every square of text gets its own ember before any gets two
      const angle = -.05 + (Math.random() + Math.random() - 1) * .26;
      const speed = rand(1100, 2100) * k;
      const far = Math.hypot((to % cols + .5) * c - mouth.x, (Math.floor(to / cols) + .5) * c - mouth.y);
      embers.push({ vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: rand(.3, .42) + far / Math.hypot(W, H) * .35, size: rand(14, 30) * Math.max(k, .6), to });
    }
    heat.fill(0);
    for (let n = embers.length - 1; n >= 0; n--) {
      const e = embers[n];
      e.age += dt;
      if (e.age >= e.life) {
        if (at[e.to] > t) at[e.to] = t; // landed: this square catches
        embers[n] = embers[embers.length - 1];
        embers.pop();
        continue;
      }
      const f = e.age / e.life;
      const glide = (1 - Math.exp(-drag * e.age)) / drag; // how far the first burst has carried it
      const turn = span(f, .2, 1) ** 2 * (3 - 2 * span(f, .2, 1)); // 0 while it is still a jet, 1 when it lands
      const x = mouth.x + e.vx * glide;
      const y = mouth.y + e.vy * glide;
      warm(x + ((e.to % cols + .5) * c - x) * turn, y + ((Math.floor(e.to / cols) + .5) * c - y) * turn, e.size * (.3 + .7 * span(f, 0, .18)) * (1 - .45 * f), .55 - .15 * f);
    }

    // The grid: fire spreads from where embers land, burns as pixels, cools into code, then leaves the real page.
    rush = 1 - .85 * span(t, .95, 1.3);
    let left = 0;
    for (let j = 0, n = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++, n++) {
        if (open[n]) continue;
        left++;
        if (at[n] > t) continue;
        if (i > 0) spread(n, n - 1);
        if (i < cols - 1) spread(n, n + 1);
        if (j > 0) spread(n, n - cols);
        if (j < rows - 1) spread(n, n + cols);
        const burnt = (t - at[n]) / (content[n] ? HOLD : .11);
        if (burnt >= 1) {
          open[n] = 1;
          veil.clearRect(i * cell, j * cell, cell, cell);
        } else heat[n] += content[n] ? 2.6 * (1 - burnt) ** 1.5 + .1 : .3 * (1 - burnt);
      }
    }
    if (!left) root.style.pointerEvents = "none";

    ctx.clearRect(0, 0, over.width, over.height);
    for (let j = 0, n = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++, n++) {
        const h = heat[n];
        if (h < LEVELS[LEVELS.length - 1]) continue;
        let level = 0;
        while (h < LEVELS[level]) level++;
        ctx.fillStyle = SHADES[level];
        if (level < PIXELS) ctx.fillRect(i * cell + gap, j * cell + gap, cell - gap * 2, cell - gap * 2);
        else ctx.fillText(GLYPHS[(n * 7 + Math.floor(t * 12 + grain[n] * 12)) % GLYPHS.length], (i + .5) * cell, (j + .5) * cell);
      }
    }

    if ((!left && !embers.length) || t > 2.6) finish();
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    // Whatever goes wrong in here, the visitor must still get the page.
    try { step(dt); } catch { finish(); }
  };
  for (const type of skipOn) window.addEventListener(type, skip, { passive: true });
  window.addEventListener("resize", resized);
  raf = requestAnimationFrame(frame);
  return stop;
}

/**
 * The opening: the tiger lands and breathes blue pixel fire, which flies into the home page's own words and buttons
 * and turns into them. Any tap, key or scroll skips it.
 */
export function Intro() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (el && !el.hidden) return play(el);
  }, []);

  return <>
    {/* Hidden unless the script below shows it. That script only runs when the browser reads it in the page itself,
        not when React draws home again after a page change, so coming back to home never replays the intro. */}
    <div ref={root} className="intro" hidden aria-hidden="true" suppressHydrationWarning>
      {/* The dark veil. Until the script takes over, its background colour alone is the veil. */}
      <canvas className="intro-veil" />
      <svg className="intro-tiger" viewBox="-5 -5 407 269">
        <defs>
          <radialGradient id="intro-heat" gradientUnits="userSpaceOnUse" cx={MOUTH.x} cy={MOUTH.y} r="200">
            <stop offset="0" stopColor="#e6f0ff" />
            <stop offset=".3" stopColor="#5a96ff" stopOpacity=".8" />
            <stop offset="1" stopColor="#3478f6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path id="intro-body" fillRule="evenodd" d={BODY} />
        <use className="intro-heat" href="#intro-body" fill="url(#intro-heat)" />
        <path className="intro-wisp" d={WISP} />
      </svg>
      <canvas className="intro-fire" />
    </div>
    <div hidden dangerouslySetInnerHTML={{ __html: `<script>${SHOW}</script>` }} />
  </>;
}
