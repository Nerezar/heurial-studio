// Run with: node --test tracker/clipdesk.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as loaded from "../public/clipdesk/core.js";

const core = loaded.default ?? globalThis.ClipDeskCore;
const at = (date, time) => new Date(`${date}T${time}`).getTime();
const post = (id, date, time, extra = {}) => ({ id, date, time, platform: "X", pillar: "Tips", views_12h: null, views_24h: null, views_72h: null, ...extra });

test("median handles odd, even, empty and blanks", () => {
  assert.equal(core.median([3, 1, 2]), 2);
  assert.equal(core.median([4, 1, 3, 2]), 2.5);
  assert.equal(core.median([]), null);
  assert.equal(core.median([null, 5, undefined]), 5);
});

test("slotOf buckets the hour, and early morning is night", () => {
  assert.equal(core.slotOf("06:30"), "Morning");
  assert.equal(core.slotOf("12:00"), "Midday");
  assert.equal(core.slotOf("15:59"), "Afternoon");
  assert.equal(core.slotOf("18:00"), "Evening");
  assert.equal(core.slotOf("23:00"), "Night");
  assert.equal(core.slotOf("02:00"), "Night");
});

test("dueChecks lists reads that are due and empty, oldest first, and skips filled or future ones", () => {
  const now = at("2026-11-20", "12:00");
  const posts = [
    post("a", "2026-11-20", "06:00"),                                   // 6h old: nothing due
    post("b", "2026-11-19", "11:00"),                                   // 25h: 12h and 24h due
    post("c", "2026-11-19", "11:00", { views_12h: 100, views_24h: 300 }), // filled
    post("d", "2026-11-01", "11:00"),                                   // too old to chase
    post("e", "2026-11-21", "11:00"),                                   // in the future
    post("f", "2026-11-19", "11:00", { skipped: [12, 24] }),             // marked not available
  ];
  const due = core.dueChecks(posts, now).map((d) => `${d.post.id}:${d.hours}:${d.lateBy}`);
  assert.deepEqual(due, ["b:12:13", "b:24:1"]);
});

test("review compares 24h reads only, ranks them and groups by pillar against the page median", () => {
  const now = at("2026-11-20", "12:00");
  const posts = [
    post("1", "2026-11-15", "09:00", { views_24h: 100, pillar: "News" }),
    post("2", "2026-11-16", "13:00", { views_24h: 400, pillar: "Tips", test_name: "hook: question" }),
    post("3", "2026-11-17", "13:00", { views_24h: 200, pillar: "Tips", test_name: "hook: question" }),
    post("4", "2026-11-18", "19:00", { views_24h: 50, pillar: "Clip" }),
    post("5", "2026-11-20", "08:00", { views_12h: 900 }),               // no 24h read yet: not judged
    post("6", "2026-11-01", "08:00", { views_24h: 9999 }),              // outside the 7 days
  ];
  const r = core.review(posts, now, 7);
  assert.equal(r.count, 4);
  assert.equal(r.median, 150);
  assert.deepEqual(r.top.map((p) => p.id), ["2", "3", "1"]);
  assert.deepEqual(r.bottom.map((p) => p.id), ["4", "1", "3"]);
  const tips = r.byPillar.find((g) => g.key === "Tips");
  assert.equal(tips.median, 300);
  assert.equal(tips.vsPage, 1);
  assert.deepEqual(r.byTest.map((g) => g.key), ["hook: question"]);
  assert.equal(r.bySlot[0].key, "Midday");
});

test("week compares this week's median 24h read with last week's", () => {
  const now = at("2026-11-20", "12:00");
  const posts = [
    post("a", "2026-11-19", "10:00", { views_24h: 300 }),
    post("b", "2026-11-18", "10:00", { views_24h: 100 }),
    post("c", "2026-11-10", "10:00", { views_24h: 50 }),
  ];
  const w = core.week(posts, now);
  assert.equal(w.posts, 2);
  assert.equal(w.median, 200);
  assert.equal(w.lastMedian, 50);
  assert.equal(w.best.id, "a");
});

test("staleFacts flags facts never checked or checked over 48 hours ago", () => {
  const now = at("2026-11-20", "12:00");
  const facts = [
    { id: "1", checked: new Date(at("2026-11-19", "12:00")).toISOString() },
    { id: "2", checked: new Date(at("2026-11-17", "12:00")).toISOString() },
    { id: "3", checked: "" },
  ];
  assert.deepEqual(core.staleFacts(facts, now).map((f) => f.id), ["2", "3"]);
});

test("toCSV writes scoreboard.csv columns and quotes commas, quotes and line breaks", () => {
  const csv = core.toCSV([post("p1", "2026-11-19", "10:00", { hook: 'He said "wait", then\nleft', views_24h: 1200 })]);
  const [head, ...rest] = csv.trimEnd().split("\n");
  assert.equal(head, core.COLUMNS.join(","));
  assert.ok(rest.join("\n").includes('"He said ""wait"", then\nleft"'));
  assert.ok(csv.startsWith("post_id,date,time,platform"));
});

test("readCount keeps blanks as not-read and refuses anything but whole numbers", () => {
  assert.equal(core.readCount(""), null);
  assert.equal(core.readCount("12,400"), 12400);
  assert.equal(core.readCount("0"), 0);
  assert.equal(core.readCount("-3"), undefined);
  assert.equal(core.readCount("1.5"), undefined);
  assert.equal(core.readCount("lots"), undefined);
});

test("validBackup accepts this page's backups and refuses other files", () => {
  assert.ok(core.validBackup({ posts: [post("a", "2026-11-19", "10:00")], facts: [], credits: [], rules: [] }));
  assert.ok(!core.validBackup({ posts: [] }));
  assert.ok(!core.validBackup({ posts: [{ id: 1, date: "x" }], facts: [], credits: [], rules: [] }));
  assert.ok(!core.validBackup(null));
});
