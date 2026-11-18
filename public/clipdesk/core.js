/* HEURIAL Clip Desk: the numbers behind the page, kept apart from its drawing. No DOM here.
   Tested in tracker/clipdesk.test.mjs.

   A post is { id, date: "YYYY-MM-DD", time: "HH:MM", platform, pillar, format, hook, length_sec, credit,
   views_12h, views_24h, views_72h, likes, reposts_or_shares, replies_or_comments, saves_or_bookmarks,
   followers_at_read, test_name, notes }. A number nobody has read yet is null, never a guess. */
(function (root) {
  const HOUR = 3600e3;
  const CHECKS = [12, 24, 72];
  // The columns of scoreboard.csv, in its order, so an export drops straight into the sheet.
  const COLUMNS = ["post_id", "date", "time", "platform", "pillar", "format", "hook", "length_sec", "credit",
    "views_12h", "views_24h", "views_72h", "likes", "reposts_or_shares", "replies_or_comments",
    "saves_or_bookmarks", "followers_at_read", "test_name", "notes"];
  const SLOTS = [["Morning", 5], ["Midday", 11], ["Afternoon", 14], ["Evening", 17], ["Night", 21]];

  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  function median(values) {
    const xs = values.filter(isNum).sort((a, b) => a - b);
    if (!xs.length) return null;
    const mid = xs.length >> 1;
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  }

  /** When the post went out, in the viewer's local time. A post without a time counts as noon. */
  function postedAt(post) {
    return new Date(`${post.date}T${post.time || "12:00"}`).getTime();
  }

  function slotOf(time) {
    const h = Number(String(time || "12:00").slice(0, 2));
    let name = "Night";
    for (const [label, start] of SLOTS) if (h >= start) name = label;
    return h < 5 ? "Night" : name;
  }

  /** Metric reads that are due: the post has reached 12, 24 or 72 hours and that number is still empty.
      A read marked skipped (the number wasn't available) stays blank and stops asking. Posts older than
      10 days are left alone; a read that late isn't comparable. */
  function dueChecks(posts, now) {
    const out = [];
    for (const post of posts) {
      const age = now - postedAt(post);
      if (!(age >= 0) || age > 10 * 24 * HOUR) continue;
      for (const h of CHECKS) {
        if (age >= h * HOUR && !isNum(post[`views_${h}h`]) && !(post.skipped || []).includes(h)) out.push({ post, hours: h, lateBy: Math.floor(age / HOUR) - h });
      }
    }
    return out.sort((a, b) => b.lateBy - a.lateBy);
  }

  /** Posts in the last `days` days (by post date) whose 24-hour read is in. The 24-hour read is the one every
      post gets, so it's the fair comparison; nothing is judged before it. */
  function measured(posts, now, days) {
    const from = now - days * 24 * HOUR;
    return posts.filter((p) => postedAt(p) >= from && postedAt(p) <= now && isNum(p.views_24h));
  }

  function groupBy(posts, keyOf, pageMedian) {
    const groups = new Map();
    for (const p of posts) {
      const key = keyOf(p) || "None";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p.views_24h);
    }
    return [...groups].map(([key, views]) => {
      const m = median(views);
      return { key, posts: views.length, median: m, vsPage: pageMedian ? (m - pageMedian) / pageMedian : null };
    }).sort((a, b) => b.median - a.median);
  }

  /** The weekly review: best and worst three, and medians by pillar, time slot, platform and test. */
  function review(posts, now, days = 7) {
    const set = measured(posts, now, days);
    const pageMedian = median(set.map((p) => p.views_24h));
    const ranked = [...set].sort((a, b) => b.views_24h - a.views_24h);
    return {
      count: set.length,
      median: pageMedian,
      top: ranked.slice(0, 3),
      bottom: ranked.length > 3 ? ranked.slice(-3).reverse() : [],
      byPillar: groupBy(set, (p) => p.pillar, pageMedian),
      bySlot: groupBy(set, (p) => slotOf(p.time), pageMedian),
      byPlatform: groupBy(set, (p) => p.platform, pageMedian),
      byTest: groupBy(set.filter((p) => p.test_name), (p) => p.test_name, pageMedian),
    };
  }

  /** This week against the week before, for the tiles on Today. */
  function week(posts, now) {
    const span = 7 * 24 * HOUR;
    const inRange = (p, a, b) => postedAt(p) > a && postedAt(p) <= b;
    const thisWeek = posts.filter((p) => inRange(p, now - span, now));
    const lastWeek = posts.filter((p) => inRange(p, now - 2 * span, now - span));
    const best = thisWeek.filter((p) => isNum(p.views_24h)).sort((a, b) => b.views_24h - a.views_24h)[0] || null;
    return {
      posts: thisWeek.length,
      median: median(thisWeek.map((p) => p.views_24h)),
      lastMedian: median(lastWeek.map((p) => p.views_24h)),
      best,
    };
  }

  /** Facts last checked more than 48 hours ago (or never) need checking again before they're used. */
  function staleFacts(facts, now) {
    return facts.filter((f) => !f.checked || now - new Date(f.checked).getTime() > 48 * HOUR);
  }

  function csvCell(v) {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function toCSV(posts) {
    const rows = posts.map((p) => COLUMNS.map((c) => csvCell(c === "post_id" ? p.id : p[c])).join(","));
    return [COLUMNS.join(","), ...rows].join("\n") + "\n";
  }

  /** A number field from a form: blank stays null (not read yet), anything else must be a whole number >= 0. */
  function readCount(raw) {
    const s = String(raw ?? "").replace(/[,\s]/g, "");
    if (s === "") return null;
    const n = Number(s);
    return Number.isInteger(n) && n >= 0 ? n : undefined;
  }

  /** Checks a restored backup has the shape this page writes, so a wrong file can't break the page. */
  function validBackup(data) {
    return !!data && typeof data === "object" && ["posts", "facts", "credits", "rules"].every((k) => Array.isArray(data[k]))
      && data.posts.every((p) => p && typeof p.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date));
  }

  const api = { CHECKS, COLUMNS, median, postedAt, slotOf, dueChecks, review, week, staleFacts, toCSV, readCount, validBackup };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ClipDeskCore = api;
})(typeof window !== "undefined" ? window : globalThis);
