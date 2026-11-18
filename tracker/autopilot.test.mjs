// Run with: node --test tracker/autopilot.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as loaded from "../public/autopilot/core.js";

const core = loaded.default ?? globalThis.AutopilotCore;
const at = (date, time) => new Date(`${date}T${time}`).getTime();
const hours = { open: "08:00", close: "20:00" };

test("the catalog has 30 automations with unique ids, and the plans unlock 8, 19 and 30", () => {
  assert.equal(core.CATALOG.length, 30);
  assert.equal(new Set(core.CATALOG.map((a) => a.id)).size, 30);
  const count = (plan) => core.CATALOG.filter((a) => core.unlocked(a, plan)).length;
  assert.deepEqual(core.PLANS.map((p) => count(p.id)), [8, 19, 30]);
  for (const a of core.CATALOG) assert.ok(core.CATEGORIES.includes(a.category), a.id);
});

test("every message template only uses placeholders the app fills", () => {
  const known = new Set(["first_name", "business", "booking_link", "review_link", "topic", "when", "invoice", "amount", "pay_link"]);
  for (const a of core.CATALOG) for (const [, key] of a.template.matchAll(/\{(\w+)\}/g)) assert.ok(known.has(key), `${a.id}: {${key}}`);
});

test("render fills placeholders and reports the ones it can't fill", () => {
  assert.deepEqual(core.render("Hi {first_name}, from {business}.", { first_name: "Ana", business: "Northside" }), { text: "Hi Ana, from Northside.", missing: [] });
  const r = core.render("Book: {booking_link}", { booking_link: "" });
  assert.equal(r.text, "Book: {booking_link}");
  assert.deepEqual(r.missing, ["booking_link"]);
});

test("sendTime holds texts outside business hours until the next opening", () => {
  assert.equal(core.sendTime(at("2026-11-18", "14:00"), hours), at("2026-11-18", "14:00"));
  assert.equal(core.sendTime(at("2026-11-18", "06:30"), hours), at("2026-11-18", "08:00"));
  assert.equal(core.sendTime(at("2026-11-18", "21:15"), hours), at("2026-11-19", "08:00"));
  assert.equal(core.sendTime(at("2026-11-18", "20:00"), hours), at("2026-11-19", "08:00"));
});

test("isOptOut honours the standard stop words and nothing else", () => {
  for (const s of ["STOP", "stop", " Unsubscribe ", "cancel.", "QUIT!"]) assert.ok(core.isOptOut(s), s);
  for (const s of ["C", "please don't stop", "R", ""]) assert.ok(!core.isOptOut(s), s);
});

test("plan runs only enabled, unlocked automations for the trigger, and follows the rules for each", () => {
  const base = { plan: "pro", used: 0, now: at("2026-11-18", "14:00"), hours, settings: {}, contact: { first_name: "Ana" } };
  const enabled = { "missed-call": true, "review-ask": true, "paid-thanks": true, "social-drafts": true };
  const call = core.plan("missed_call", { ...base, enabled });
  assert.deepEqual(call.map((s) => [s.automation.id, s.status]), [["missed-call", "sent"]]);
  // A Business-only automation stays off on Pro even if switched on.
  const paid = core.plan("job_paid", { ...base, enabled });
  assert.deepEqual(paid.map((s) => [s.automation.id, s.status]), [["review-ask", "sent"], ["paid-thanks", "sent"]]);
  // At night the text waits for the morning; the email doesn't.
  const night = core.plan("job_paid", { ...base, enabled, now: at("2026-11-18", "22:00") });
  assert.deepEqual(night.map((s) => s.status), ["queued", "sent"]);
  assert.equal(night[0].at, at("2026-11-19", "08:00"));
  // Opted-out contacts get no texts.
  const out = core.plan("missed_call", { ...base, enabled, contact: { optedOut: true } });
  assert.deepEqual(out.map((s) => [s.status, s.reason]), [["skipped", "They asked not to be texted"]]);
});

test("AI automations wait for approval by default, use a credit each, and stop when credits run out", () => {
  const base = { plan: "pro", now: at("2026-11-18", "14:00"), hours, contact: {}, enabled: { "quote-followup": true } };
  assert.equal(core.plan("proposal_quiet", { ...base, used: 0, settings: {} })[0].status, "approval");
  assert.equal(core.plan("proposal_quiet", { ...base, used: 500, settings: {} })[0].status, "waiting");
  assert.equal(core.plan("proposal_quiet", { ...base, used: 0, settings: { "quote-followup": { approve: false } } })[0].status, "sent");
  assert.equal(core.creditsLeft("pro", 120), 380);
  assert.equal(core.creditsLeft("starter", 400), 0);
});
