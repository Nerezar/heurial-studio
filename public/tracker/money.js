/* HEURIAL tracker: the data behind the money chart, kept apart from its drawing so real transactions can be
   plugged in later. No page, no colours: entries in, a running balance out. Tested in tracker/money.test.mjs.

   An entry is { date: "YYYY-MM-DD", cents, kind, label }. `cents` is always positive. `kind` is:
     "earning"     money a client paid. Raises the balance and counts as earned.
     "deposit"     money put in. Raises the balance, is not earned.
     "withdrawal"  money taken out. Lowers the balance, is not a loss of earnings. */
(function (root) {
  const at = (day) => new Date(day + "T12:00:00");
  const pad = (n) => String(n).padStart(2, "0");
  const dayDiff = (a, b) => Math.round((at(a) - at(b)) / 864e5);
  const addDays = (day, n) => { const d = at(day); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  /**
   * The balance across a period ending today. `days` is the period's length, or null for everything.
   * Returns where the period starts (`first`, `span` days long), the balance going in (`start`) and now (`total`),
   * each change inside it (`steps`: its day in the period, the balance after it, the entry), what was earned in the
   * period (`earned`) and in the period just before it (`before`), and whether any entry is a deposit or withdrawal.
   */
  function series(entries, { today, days }) {
    const list = entries.filter((e) => e.date && e.cents > 0).sort((a, b) => a.date.localeCompare(b.date));
    const first = days ? addDays(today, -days) : addDays(list.length ? list[0].date : today, -2);
    const prior = days ? addDays(first, -days) : "";
    const span = Math.max(1, dayDiff(today, first));
    let total = 0, start = 0, earned = 0, before = 0;
    const steps = [];
    for (const entry of list) {
      const signed = entry.kind === "withdrawal" ? -entry.cents : entry.cents, isEarning = entry.kind === "earning";
      if (entry.date >= first) {
        steps.push({ day: Math.max(0, Math.min(span, dayDiff(entry.date, first))), total: total + signed, entry });
        if (isEarning) earned += entry.cents;
      } else {
        start += signed;
        if (isEarning && prior && entry.date >= prior) before += entry.cents;
      }
      total += signed;
    }
    return { first, span, start, total, earned, before, transfers: list.some((e) => e.kind !== "earning"), steps };
  }

  const api = { series };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HeurialMoney = api;
})(typeof window !== "undefined" ? window : globalThis);
