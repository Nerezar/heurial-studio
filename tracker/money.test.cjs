// Run with: node --test tracker/money.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const { series } = require("../public/tracker/money.js");

const entries = [
  { date: "2026-01-05", cents: 50000, kind: "deposit", label: "Opening deposit" },
  { date: "2026-02-20", cents: 30000, kind: "earning", label: "Before the period" },
  { date: "2026-03-10", cents: 49500, kind: "earning", label: "Client A" },
  { date: "2026-03-12", cents: 20000, kind: "withdrawal", label: "Software" },
  { date: "2026-03-20", cents: 100000, kind: "deposit", label: "Top-up" },
];

test("a deposit raises the balance without counting as earned", () => {
  const m = series(entries, { today: "2026-03-31", days: 30 });
  assert.equal(m.start, 80000); // deposit + the earlier payment
  assert.equal(m.total, 209500); // 800 + 495 - 200 + 1000
  assert.equal(m.earned, 49500); // only Client A
  assert.equal(m.before, 30000); // the payment in the 30 days before
  assert.equal(m.transfers, true);
  assert.deepEqual(m.steps.map((s) => s.total), [129500, 109500, 209500]);
});

test("all time starts just before the first entry, and earnings alone have no transfers", () => {
  const m = series(entries.filter((e) => e.kind === "earning"), { today: "2026-03-31", days: null });
  assert.equal(m.first, "2026-02-18");
  assert.equal(m.start, 0);
  assert.equal(m.total, 79500);
  assert.equal(m.earned, 79500);
  assert.equal(m.transfers, false);
});

test("no entries gives an empty, flat period", () => {
  const m = series([], { today: "2026-03-31", days: 7 });
  assert.deepEqual([m.start, m.total, m.earned, m.steps.length, m.span], [0, 0, 0, 0, 7]);
});
