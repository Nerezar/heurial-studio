const turn = Math.PI * 2;

function project(longitude: number, latitude: number) {
  const radius = 192 + 54 * Math.cos(latitude) + 12 * Math.sin(3 * longitude);
  const x = radius * Math.cos(longitude);
  const y = radius * Math.sin(longitude);
  const height = 51 * Math.sin(latitude) + 24 * Math.sin(2 * longitude);
  const tilted = y * .54 - height * .84;
  const depth = y * .84 + height * .54;
  const perspective = 920 / (920 - depth);
  return [
    428 + (x * .96 + tilted * .28) * perspective,
    247 + (tilted * .96 - x * .28) * perspective,
  ].map((coordinate) => coordinate.toFixed(1)).join(",");
}

function trace(samples: number, point: (angle: number) => string) {
  return Array.from({ length: samples + 1 }, (_, index) => point(index * turn / samples)).join(" ");
}

const latitudes = Array.from({ length: 23 }, (_, index) =>
  trace(88, (angle) => project(angle, index * turn / 23)),
);
const ribs = Array.from({ length: 24 }, (_, index) =>
  trace(26, (angle) => project(index * turn / 24, angle)),
);
const planeLines = Array.from({ length: 11 }, (_, index) => {
  const offset = index * 40;
  return `M${80 + offset} ${321 + offset * .32}l400 -128 M${80 + offset} ${321 - offset * .32}l400 128`;
}).join(" ");

export function SystemField() {
  return <svg className="field-svg" viewBox="0 0 850 516" fill="none" aria-hidden="true">
    <g className="field-plane">
      <path d={planeLines} />
      <path d="M80 321 480 193 880 321 480 449Z" />
      <path d="M428 29v425M40 247h748" strokeDasharray="2 8" />
    </g>
    <g className="field-model">
      {ribs.map((points, index) => <polyline key={index} points={points} className="field-rib" />)}
      {latitudes.map((points, index) => <polyline key={index} points={points} className={index === 4 || index === 16 ? "field-contour is-signal" : "field-contour"} />)}
      <polyline className="field-pulse" points={latitudes[4]} pathLength="100" />
    </g>
    <g className="field-annotations">
      <path d="M132 155h66l34 32M630 340l34 40h82M428 65v19m-9-9h18M419 247h18m-9-9v18" />
      <circle cx="232" cy="187" r="3" /><circle cx="630" cy="340" r="3" />
      <text x="132" y="144">01 / INPUTS</text>
      <text x="666" y="399">02 / SIGNAL</text>
      <text x="479" y="448">H / SYSTEM STUDY</text>
    </g>
  </svg>;
}
