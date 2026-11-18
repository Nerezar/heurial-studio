// Run with: node --test tracker/money.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as loaded from "../public/tracker/money.js";

// money.js is a plain browser script: under Node it either exports itself or sets a global, depending on how it is read.
const { series, entries: build } = loaded.default ?? globalThis.HeurialMoney;

const entries = [
  { date: "2026-01-05", cents: 50000, kind: "transfer_in", label: "Opening deposit" },
  { date: "2026-02-20", cents: 30000, kind: "income", label: "Before the period" },
  { date: "2026-03-10", cents: 49500, kind: "income", label: "Client A" },
  { date: "2026-03-12", cents: 20000, kind: "expense", label: "Software" },
  { date: "2026-03-20", cents: 100000, kind: "transfer_in", label: "Top-up" },
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
  const m = series(entries.filter((e) => e.kind === "income"), { today: "2026-03-31", days: null });
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

test("an entry dated after today is left out until its day comes", () => {
  const withFuture = [...entries, { date: "2026-04-05", cents: 70000, kind: "income", label: "Not yet paid" }, { date: "2026-04-02", cents: 5000, kind: "expense", label: "Planned" }];
  const now = series(withFuture, { today: "2026-03-31", days: 30 });
  assert.deepEqual([now.total, now.earned, now.steps.length], [209500, 49500, 3]);
  const later = series(withFuture, { today: "2026-04-05", days: 30 });
  assert.equal(later.total, 209500 - 5000 + 70000);
});

test("a period with no starting balance starts from zero and keeps exact cents", () => {
  const m = series([{ date: "2026-03-30", cents: 4550, kind: "expense", label: "Software" }, { date: "2026-03-29", cents: 10025, kind: "income", label: "Client" }], { today: "2026-03-31", days: 7 });
  assert.deepEqual([m.start, m.total, m.earned], [0, 5475, 10025]);
});

// ---------- The reliability pass ----------

const reconciles = (m) => m.start + m.earned - m.spent + m.moved_in - m.moved_out - m.unsorted === m.total;
const mixed = [
  { date: "2026-03-01", cents: 100000, kind: "transfer_in", label: "Opening" },
  { date: "2026-03-10", cents: 49500, kind: "income", label: "Client A" },
  { date: "2026-03-24", cents: 20050, kind: "expense", label: "Software" },
  { date: "2026-03-30", cents: 30000, kind: "transfer_out", label: "Paid myself" },
  { date: "2026-03-30", cents: 5000, kind: "out", label: "Old entry, no category" },
  { date: "2026-03-31", cents: 120000, kind: "income", label: "Client B" },
  { date: "2026-04-02", cents: 99900, kind: "income", label: "Scheduled, not yet in" },
];

test("the line, the sums and the total reconcile in every range", () => {
  for (const days of [1, 7, 30, 90, 365, null]) {
    const m = series(mixed, { today: "2026-03-31", days });
    assert.ok(reconciles(m), `range ${days}`);
    assert.equal(m.total, 214450); // the same balance whatever the range; the entry dated ahead is not in it
    assert.equal(m.steps.length ? m.steps[m.steps.length - 1].total : m.start, m.total);
  }
});

test("a transfer out is not an expense, and neither counts as earned", () => {
  const m = series(mixed, { today: "2026-03-31", days: 30 });
  assert.deepEqual([m.earned, m.spent, m.moved_in, m.moved_out, m.unsorted], [169500, 20050, 0, 30000, 5000]);
  assert.equal(m.start, 100000); // Mar 1 is the day before a 30-day period ending Mar 31
  assert.equal(m.from, "2026-03-02");
});

test("a period of one day is today alone, and seven is today and the six days before", () => {
  const one = series(mixed, { today: "2026-03-31", days: 1 });
  assert.deepEqual(one.steps.map((s) => s.entry.label), ["Client B"]); // nothing from Mar 30
  assert.equal(one.from, "2026-03-31");
  const week = series(mixed, { today: "2026-03-31", days: 7 });
  assert.equal(week.from, "2026-03-25");
  assert.deepEqual(week.steps.map((s) => s.entry.date), ["2026-03-30", "2026-03-30", "2026-03-31"]); // Mar 24 is the day before it
});

test("a balance below zero is reported, so the chart can make room for it", () => {
  const m = series([{ date: "2026-03-10", cents: 5000, kind: "income", label: "A" }, { date: "2026-03-12", cents: 30000, kind: "expense", label: "Rent" }], { today: "2026-03-31", days: 30 });
  assert.equal(m.total, -25000);
  assert.equal(m.low, -25000);
});

test("a recorded payment stands on its own; a paid lead without one is still shown, marked as derived", () => {
  const lead = (id, extra) => ({ id, name: `Lead ${id}`, status: "paid", value_cents: 49500, booked_at: "2026-03-01", paid_at: "2026-03-05", ...extra });
  const tx = [{ id: "9", date: "2026-03-05", amount_cents: 49500, kind: "income", label: "Payment from Lead 1", lead_id: "1" }];
  // Lead 1 was edited after it was paid: a new value, and moved back a stage. Its payment does not move.
  const list = build([lead("1", { status: "proposal", value_cents: 100 }), lead("2"), lead("3", { paid_at: "" })], tx);
  assert.deepEqual(list.map((e) => [e.lead_id, e.cents, e.date, Boolean(e.derived), Boolean(e.undated)]), [
    ["1", 49500, "2026-03-05", false, false],
    ["2", 49500, "2026-03-05", true, false],
    ["3", 49500, "2026-03-01", true, true],
  ]);
  assert.equal(build([lead("1")], tx).length, 1); // never counted twice
});
