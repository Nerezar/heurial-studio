/* HEURIAL tracker: the data behind the money chart, kept apart from its drawing. No page, no colours: entries
   in, a running balance out. Tested in tracker/money.test.mjs.

   An entry is { date: "YYYY-MM-DD", cents, kind, label }. `cents` is always positive. `kind` is:
     "income"        a customer paid. Raises the balance and counts as earned.
     "expense"       the business spent it. Lowers the balance and counts against profit.
     "transfer_in"   money put in. Raises the balance, is not earned.
     "transfer_out"  money taken out for yourself. Lowers the balance, is not an expense.
     "out"           an older entry that left the balance and was never given a category. It lowers the balance and
                     is counted on its own until someone says whether it was an expense or a transfer out. */
(function (root) {
  const SIGN = { income: 1, transfer_in: 1, expense: -1, transfer_out: -1, out: -1 };
  const at = (day) => new Date(day + "T12:00:00");
  const pad = (n) => String(n).padStart(2, "0");
  const dayDiff = (a, b) => Math.round((at(a) - at(b)) / 864e5);
  const addDays = (day, n) => { const d = at(day); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  /**
   * Every money entry: the saved transactions, which include each client payment as its own record, plus any paid
   * lead that has no payment record yet (paid before payments were kept). Those are marked `derived`: they still
   * follow the lead, and `undated` when the lead has no paid date and sits on its booked day instead.
   */
  function entries(leads, transactions) {
    const list = transactions.map((t) => ({ id: t.id, date: t.date, cents: t.amount_cents, kind: t.kind, label: t.label, lead_id: t.lead_id || "" }));
    const recorded = new Set(list.filter((e) => e.kind === "income" && e.lead_id).map((e) => e.lead_id));
    for (const l of leads) {
      const date = l.paid_at || l.booked_at;
      if (l.status === "paid" && l.value_cents > 0 && date && !recorded.has(l.id)) list.push({ date, cents: l.value_cents, kind: "income", label: l.name, lead_id: l.id, derived: true, undated: !l.paid_at });
    }
    return list;
  }

  /**
   * The balance across a period ending today. `days` is the period's length, or null for everything. A period of
   * N days is today and the N-1 days before it, so 1 is today alone.
   * Returns `first` (the day before the period: the line starts from that day's closing balance), `from` (the
   * period's first day), `span` (days from first to today), the balance going in (`start`) and now (`total`), the
   * lowest it reached (`low`), each change (`steps`: its day counted from `first`, the balance after it, the
   * entry), and the period's sums by kind. These always reconcile:
   *   start + earned - spent + moved_in - moved_out - unsorted = total
   * `before` is what was earned in the period of the same length just before this one.
   */
  function series(all, { today, days }) {
    // An entry dated after today hasn't happened yet: it joins the balance on its day, not before.
    const list = all.filter((e) => e.date && e.date <= today && e.cents > 0 && SIGN[e.kind]).sort((a, b) => a.date.localeCompare(b.date));
    const first = days ? addDays(today, -days) : addDays(list.length ? list[0].date : today, -2);
    const prior = days ? addDays(first, -days) : "";
    const span = Math.max(1, dayDiff(today, first));
    const sums = { income: 0, expense: 0, transfer_in: 0, transfer_out: 0, out: 0 };
    let total = 0, start = 0, before = 0, low = 0;
    const steps = [];
    for (const entry of list) {
      const signed = SIGN[entry.kind] * entry.cents;
      if (entry.date > first) {
        steps.push({ day: Math.max(0, Math.min(span, dayDiff(entry.date, first))), total: total + signed, entry });
        sums[entry.kind] += entry.cents;
      } else {
        start += signed;
        if (entry.kind === "income" && prior && entry.date > prior) before += entry.cents;
      }
      total += signed;
    }
    low = Math.min(start, ...steps.map((s) => s.total));
    return {
      first, from: addDays(first, 1), span, start, total, low, before, steps,
      earned: sums.income, spent: sums.expense, moved_in: sums.transfer_in, moved_out: sums.transfer_out, unsorted: sums.out,
      transfers: list.some((e) => e.kind !== "income"),
    };
  }

  const api = { series, entries, SIGN };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HeurialMoney = api;
})(typeof window !== "undefined" ? window : globalThis);
