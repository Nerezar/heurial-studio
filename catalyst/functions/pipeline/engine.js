// The Autopilot engine: an event comes in, the rules decide what each automation does, every message becomes an
// Outbox row, and a tick sends what's due. See catalyst/AUTOPILOT-PLAN.md.
//
// It knows nothing about tenants or providers. Every function takes a store already scoped to one business
// (list, get, insert, update, as in store.js) and a ctx for that business:
//   { tenant, plan, used, enabled, settings, hours, vars: { business, booking_link, ... }, textsPerHour? }
// `core` is the Autopilot rules (public/autopilot/core.js). `send(row)` delivers one Outbox row and returns
// { id } from the provider; `check(row)` answers "sent", "not_sent" or "unknown" for a row whose outcome was lost.
//
// Outbox status: approval → queued → sending → sent | failed, or skipped / waiting / logged with a reason.

const { Bad } = require("./core");

const TABLES = { events: "Events", outbox: "Outbox", contacts: "Contacts" };
const MAX_ATTEMPTS = 4;
const RETRY_MINUTES = [5, 30, 120]; // wait after the 1st, 2nd and 3rd failure
const STUCK_MINUTES = 10; // a row "sending" for longer than this lost its outcome
const STALE_HOURS = 24; // a queued message this late is dropped, not sent
const DAY = 86400000;

// One thing at a time per key, so two requests for the same event or message can't both act on it.
// shortcut: this only holds inside one function instance. Before real traffic, make Events.dedupe_key a unique
// column in Catalyst so a second instance's insert fails instead.
const busy = new Map();
function alone(key, fn) {
  const run = (busy.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  busy.set(key, run);
  return run.finally(() => { if (busy.get(key) === run) busy.delete(key); });
}

function createEngine({ core, send, check, now = () => new Date() }) {

  /** Something happened: { trigger, contact (a Contacts row, or {}), payload, dedupeKey }. Saves the event and one
      Outbox row per automation that listens for it. The same dedupeKey twice does nothing the second time. */
  function ingest(store, ctx, event) {
    const key = String(event.dedupeKey || "");
    if (!key) throw new Bad("An event needs a dedupe key.", 400);
    return alone(`event:${ctx.tenant}:${key}`, async () => {
      // shortcut: reads the whole Events table. Use a query by dedupe_key once the tenant store has queries.
      if ((await store.list(TABLES.events)).some((e) => e.dedupe_key === key)) return { duplicate: true, rows: [] };
      const at = now(), iso = at.toISOString();
      const contact = event.contact || {};
      const contactId = contact.ROWID ? String(contact.ROWID) : "";
      const saved = await store.insert(TABLES.events, {
        trigger: event.trigger, contact_id: contactId, payload: JSON.stringify(event.payload || {}), dedupe_key: key, received_at: iso,
      });
      const steps = core.plan(event.trigger, { ...ctx, contact: { optedOut: Boolean(contact.opted_out_at) }, now: at.getTime() });
      const rows = [];
      for (const step of steps) {
        const a = step.automation;
        const row = {
          event_id: String(saved.ROWID), automation: a.id, contact_id: contactId, channel: a.channel, body: "",
          status: step.status, reason: step.reason || "", send_at: "", attempts: 0, provider_id: "", error: "", created_at: iso,
        };
        // The rules say "sent" for "send now"; nothing is sent until the tick does it.
        if (step.status === "sent" || step.status === "queued") { row.status = "queued"; row.send_at = new Date(step.at).toISOString(); }
        const template = (ctx.settings[a.id] || {}).message || a.template; // the owner's own wording, if they wrote one
        if (template) {
          const filled = core.render(template, { first_name: contact.first_name, ...ctx.vars, ...event.payload });
          row.body = filled.text;
          // Nothing goes out half-filled: the owner finishes it instead.
          if (filled.missing.length && row.status === "queued") { row.status = "approval"; row.send_at = ""; row.reason = "Replace the words in {curly brackets} before sending."; }
        }
        rows.push(await store.insert(TABLES.outbox, row));
      }
      return { duplicate: false, rows };
    });
  }

  /** The owner approves (with any edits) or rejects a message waiting in Approvals. Only works once. */
  function decide(store, ctx, id, { approve, body } = {}) {
    return alone(`out:${ctx.tenant}:${id}`, async () => {
      const row = await store.get(TABLES.outbox, id);
      if (!row) throw new Bad("Not found.", 404);
      if (row.status !== "approval") throw new Bad("This message was already handled.", 409);
      if (!approve) return store.update(TABLES.outbox, { ROWID: id, status: "skipped", reason: "Rejected" });
      const text = String(body ?? row.body);
      if (!text.trim()) throw new Bad("Write the message first.", 400);
      if (/\{\w+\}/.test(text)) throw new Bad("Fill in the blanks before sending.", 400);
      const at = now().getTime();
      const when = row.channel === "text" ? core.sendTime(at, ctx.hours) : at;
      return store.update(TABLES.outbox, { ROWID: id, body: text, status: "queued", reason: "", send_at: new Date(when).toISOString() });
    });
  }

  /** Sends what's due for one business. Run from the cron job. Never sends a message whose outcome is unknown. */
  async function tick(store, ctx, { limit = 50 } = {}) {
    const at = now(), iso = at.toISOString();
    const ago = (minutes) => new Date(at.getTime() - minutes * 60000).toISOString();
    const rows = await store.list(TABLES.outbox);
    const done = { sent: 0, retried: 0, failed: 0, skipped: 0, held: 0 };
    const save = (id, changes) => store.update(TABLES.outbox, { ROWID: id, ...changes });

    // A crash between "sending" and "sent": ask the provider. Without an answer it's failed for a person to check.
    for (const row of rows.filter((r) => r.status === "sending" && r.sending_at < ago(STUCK_MINUTES))) {
      const verdict = check ? await check(row).catch(() => "unknown") : "unknown";
      if (verdict === "sent") { await save(row.ROWID, { status: "sent", sent_at: iso }); done.sent++; }
      else if (verdict === "not_sent") { await save(row.ROWID, { status: "queued", send_at: iso }); done.retried++; }
      else { await save(row.ROWID, { status: "failed", error: "I can't tell if this arrived. Check before sending again." }); done.failed++; }
    }

    let textsLeft = ctx.textsPerHour == null ? Infinity
      : ctx.textsPerHour - rows.filter((r) => r.channel === "text" && r.status === "sent" && r.sent_at > ago(60)).length;
    const due = rows.filter((r) => r.status === "queued" && r.send_at <= iso).sort((a, b) => (a.send_at < b.send_at ? -1 : 1)).slice(0, limit);
    for (const stale of due) {
      await alone(`out:${ctx.tenant}:${stale.ROWID}`, async () => {
        const row = await store.get(TABLES.outbox, stale.ROWID);
        if (!row || row.status !== "queued") return;
        // After an outage or a paused plan, a day-old reminder does more harm than good.
        if (row.send_at < ago(STALE_HOURS * 60)) { await save(row.ROWID, { status: "skipped", reason: "Too late to send" }); done.skipped++; return; }
        if (row.channel === "text") {
          // Someone who replied STOP after this was queued still doesn't get it.
          const contact = row.contact_id ? await store.get(TABLES.contacts, row.contact_id) : null;
          if (contact && contact.opted_out_at) { await save(row.ROWID, { status: "skipped", reason: "They asked not to be texted" }); done.skipped++; return; }
          if (textsLeft <= 0) { done.held++; return; }
          textsLeft--;
        }
        const attempts = (Number(row.attempts) || 0) + 1;
        await save(row.ROWID, { status: "sending", attempts, sending_at: iso });
        let result;
        try {
          result = await send({ ...row, attempts });
        } catch (err) {
          const error = String((err && err.message) || err).slice(0, 300);
          if (err && err.uncertain) return; // it may have gone out: stays "sending" for the check above
          if (attempts >= MAX_ATTEMPTS) { await save(row.ROWID, { status: "failed", error }); done.failed++; return; }
          await save(row.ROWID, { status: "queued", error, send_at: new Date(at.getTime() + RETRY_MINUTES[attempts - 1] * 60000).toISOString() });
          done.retried++;
          return;
        }
        done.sent++;
        // If this write fails the row stays "sending" and the next tick checks it, instead of sending twice.
        await save(row.ROWID, { status: "sent", sent_at: iso, provider_id: String((result && result.id) || ""), error: "" })
          .catch((err) => console.error("engine: sent but not recorded", row.ROWID, err && err.message));
      });
    }
    return done;
  }

  return { ingest, decide, tick };
}

/** Time-based triggers: "2, 5 and 10 days after the quote". For items waiting since `since`, returns one event for
    the day mark each has just passed. The dedupe key holds the mark, so every tick can ask and each fires once.
    A mark passed more than `graceDays` ago is dropped, so old records don't all fire on the first run. */
function milestones(trigger, items, days, nowMs, graceDays = 2) {
  const events = [];
  for (const item of items) {
    const age = (nowMs - new Date(item.since).getTime()) / DAY;
    const mark = [...days].sort((a, b) => b - a).find((d) => age >= d);
    if (mark == null || age - mark > graceDays) continue;
    events.push({ trigger, contact: item.contact, payload: { ...item.payload, day: mark }, dedupeKey: `${trigger}:${item.id}:${item.since}:day${mark}` });
  }
  return events;
}

module.exports = { createEngine, milestones, TABLES, MAX_ATTEMPTS, RETRY_MINUTES, STUCK_MINUTES };
