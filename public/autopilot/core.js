/* HEURIAL Autopilot: the catalog, the plans and the rules every automation follows. No DOM here.
   Tested in tracker/autopilot.test.mjs.

   An automation listens for one trigger (a missed call, a paid job, a schedule) and does one thing (a text, an
   email, an AI draft, a tracker update). AI-written messages to customers wait for the owner's approval by default.
   Plans unlock automations: Starter 8, Pro 19, Business all 30. */
(function (root) {
  const PLANS = [
    { id: "starter", name: "Starter", credits: 100, note: "The basics, so no new customer slips through." },
    { id: "pro", name: "Pro", credits: 500, note: "Follow-ups, reviews and unpaid bills handled for you." },
    { id: "business", name: "Business", credits: 2000, note: "Everything, including reports and posts written for you." },
  ];

  const CATEGORIES = ["New customers", "Following up", "Appointments", "Reviews", "Getting paid", "Reports for me", "Bringing customers back", "Website and posts"];

  // trigger ids: missed_call, web_inquiry, email_in, proposal_quiet, lead_quiet, call_ended, lead_stale,
  // appointment_soon, appointment_missed, job_paid, review_posted, invoice_overdue, receipt_in, schedule, question
  const A = (id, name, category, plan, trigger, channel, ai, description, template = "") =>
    ({ id, name, category, plan, trigger, channel, ai, description, template });
  const CATALOG = [
    A("missed-call", "Text back when I miss a call", "New customers", "starter", "missed_call", "text", false, "When I can't pick up, the caller gets a text within a minute and is added to my list.", "Hi {first_name}, sorry I missed your call. This is {business}. What can I help with?"),
    A("web-reply", "Answer website messages right away", "New customers", "starter", "web_inquiry", "email", false, "Anyone who writes in through my website gets a reply straight away, day or night.", "Hi {first_name}, thanks for getting in touch with {business}. I'll reply properly within a few hours. If it's easier to talk, book a time here: {booking_link}"),
    A("email-lead", "Add emailed requests to my list", "New customers", "starter", "email_in", "tracker", false, "Emails sent to my forwarding address are added to my list, with the whole message."),
    A("hot-alert", "Text me about urgent requests", "New customers", "starter", "web_inquiry", "owner", false, "I get a text when someone asks for a quote or mentions a date.", "New lead: {first_name} wants {topic}. Reply soon."),
    A("lead-source", "Track where customers found me", "New customers", "pro", "web_inquiry", "tracker", false, "Each new customer is marked with where they came from, so I know what's working."),
    A("quote-followup", "Follow up on quotes", "Following up", "pro", "proposal_quiet", "email", true, "If someone doesn't answer a quote, they get a friendly nudge on day 2, 5 and 10."),
    A("revive", "Check in with people who went quiet", "Following up", "pro", "lead_quiet", "email", true, "People who stopped replying get a short, personal check-in after 30, 60 and 90 days."),
    A("call-recap", "Send a summary after a call", "Following up", "pro", "call_ended", "email", true, "After a call, a short email of what we agreed is written for me to check."),
    A("stale-cleanup", "Tidy up old requests", "Following up", "business", "lead_stale", "tracker", false, "Requests with no news for 4 months are closed, so my list stays short."),
    A("reminders", "Remind customers the day before", "Appointments", "starter", "appointment_soon", "text", false, "Customers get a text the day before their appointment, with the time.", "Hi {first_name}, a reminder from {business}: see you {when}. Reply C to confirm or R to reschedule."),
    A("confirm", "Let customers confirm by text", "Appointments", "starter", "appointment_soon", "text", false, "Customers reply C to confirm or R to pick a new time."),
    A("no-show", "Follow up on missed appointments", "Appointments", "pro", "appointment_missed", "text", false, "If someone misses an appointment, they get a kind text with a link to rebook.", "Hi {first_name}, sorry we missed you today. Pick a new time here: {booking_link}"),
    A("booking-link", "Add my booking link to replies", "Appointments", "pro", "web_inquiry", "email", false, "My booking link goes in every first reply, so people can pick a time themselves."),
    A("review-ask", "Ask happy customers for a review", "Reviews", "starter", "job_paid", "text", false, "After a customer pays, they get a thank-you and a link to leave a Google review.", "Thanks for choosing {business}, {first_name}. If you have a minute, a review helps a lot: {review_link}"),
    A("review-reply", "Write replies to my reviews", "Reviews", "pro", "review_posted", "owner", true, "Each new review gets a reply written for me to check and post."),
    A("testimonial", "Ask to quote great reviews", "Reviews", "business", "review_posted", "email", false, "Customers who leave 5 stars are asked if I can use their words on my website.", "Thank you for the kind review, {first_name}. Would you mind if I quoted it on my website?"),
    A("invoice-chase", "Remind people about unpaid bills", "Getting paid", "pro", "invoice_overdue", "email", false, "Late bills get polite reminders after 3, 7 and 14 days. Then I'm told.", "Hi {first_name}, a quick reminder that invoice {invoice} for {amount} is now due. You can pay here: {pay_link}"),
    A("paid-thanks", "Say thank you when someone pays", "Getting paid", "pro", "job_paid", "email", false, "A receipt and a thank-you go out as soon as a payment comes in.", "Thanks, {first_name}. I've received {amount}. It was a pleasure working with you."),
    A("receipts", "Sort my receipts", "Getting paid", "business", "receipt_in", "tracker", true, "I forward a receipt and it's filed under the right expense."),
    A("expense-summary", "Monthly spending summary", "Getting paid", "business", "schedule", "owner", false, "On the 1st, I get where my money went last month."),
    A("daily-brief", "Morning summary for me", "Reports for me", "starter", "schedule", "owner", false, "Every morning: new requests, follow-ups and appointments for the day."),
    A("weekly-numbers", "Weekly numbers for me", "Reports for me", "pro", "schedule", "owner", false, "Every Monday: calls, new customers, jobs won and money in, compared with last week."),
    A("monthly-report", "Monthly report for me", "Reports for me", "business", "schedule", "owner", true, "A one-page summary of my month in plain English, with what to fix next."),
    A("birthdays", "Birthday notes to customers", "Bringing customers back", "business", "schedule", "email", false, "A short note on a customer's birthday or the anniversary of their first job.", "Happy birthday from everyone at {business}, {first_name}."),
    A("referral", "Ask for referrals", "Bringing customers back", "business", "review_posted", "email", false, "Happy customers are asked once if they know anyone who could use me.", "Thanks again, {first_name}. If you know anyone who could use {business}, I'd be grateful for the introduction."),
    A("rebook", "Remind customers when they're due again", "Bringing customers back", "pro", "schedule", "text", false, "Customers due for their next visit get a message with my booking link.", "Hi {first_name}, it's about time for your next visit with {business}. Book here: {booking_link}"),
    A("seasonal", "Seasonal offers to past customers", "Bringing customers back", "business", "schedule", "email", true, "Before each season, an email to past customers is written for me to check."),
    A("site-assistant", "Answer questions on my website", "Website and posts", "business", "question", "web", true, "A chat on my website answers common questions and books calls. Anything else comes to me."),
    A("social-drafts", "Write social posts about my jobs", "Website and posts", "business", "job_paid", "owner", true, "A finished job becomes a social post, written for me to add photos to."),
    A("gbp-posts", "Write my Google posts", "Website and posts", "business", "schedule", "owner", true, "A weekly post for my Google listing is written from my recent work."),
  ];

  const rank = (plan) => PLANS.findIndex((p) => p.id === plan);
  const planOf = (id) => PLANS.find((p) => p.id === id);

  /** Whether a plan includes an automation. */
  function unlocked(automation, plan) {
    return rank(plan) >= rank(automation.plan);
  }

  /** The plan that first unlocks an automation. */
  function unlockedBy(automation) {
    return planOf(automation.plan);
  }

  /** Fills {placeholders}. Anything without a value is left as-is and reported, so nothing goes out half-filled. */
  function render(template, vars) {
    const missing = [];
    const text = String(template || "").replace(/\{(\w+)\}/g, (m, key) => {
      if (vars[key] == null || vars[key] === "") { missing.push(key); return m; }
      return String(vars[key]);
    });
    return { text, missing };
  }

  /** Texts only go out in business hours. Returns when a text triggered at `now` may be sent: now if inside the
      hours, otherwise the next opening time. Hours are local "HH:MM" strings; days are every day. */
  function sendTime(now, hours) {
    const at = new Date(now);
    const [oh, om] = hours.open.split(":").map(Number);
    const [ch, cm] = hours.close.split(":").map(Number);
    const mins = at.getHours() * 60 + at.getMinutes();
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    if (mins >= open && mins < close) return now;
    const next = new Date(at);
    if (mins >= close) next.setDate(next.getDate() + 1);
    next.setHours(oh, om, 0, 0);
    return next.getTime();
  }

  /** Replies that mean "stop texting me". Carriers require these to be honoured straight away. */
  function isOptOut(reply) {
    return /^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*[.!]?\s*$/i.test(String(reply || ""));
  }

  /** AI drafts left this month. An AI automation with none left waits instead of running. */
  function creditsLeft(plan, used) {
    return Math.max(0, planOf(plan).credits - used);
  }

  /** What happens when a trigger fires for a contact: one step per automation that listens for it.
      Off or locked automations are skipped silently; texts respect opt-outs and business hours; AI drafts
      use a credit and wait for approval when the automation asks for it. */
  function plan(trigger, ctx) {
    const steps = [];
    let credits = creditsLeft(ctx.plan, ctx.used);
    for (const a of CATALOG) {
      if (a.trigger !== trigger || !unlocked(a, ctx.plan) || !ctx.enabled[a.id]) continue;
      const settings = ctx.settings[a.id] || {};
      if (a.channel === "text" && ctx.contact.optedOut) { steps.push({ automation: a, status: "skipped", reason: "They asked not to be texted" }); continue; }
      if (a.ai && credits <= 0) { steps.push({ automation: a, status: "waiting", reason: "No written messages left this month" }); continue; }
      if (a.ai) credits--;
      const approve = settings.approve ?? a.ai;
      if (approve) { steps.push({ automation: a, status: "approval", ai: a.ai }); continue; }
      if (a.channel === "text") {
        const when = sendTime(ctx.now, ctx.hours);
        steps.push({ automation: a, status: when > ctx.now ? "queued" : "sent", at: when });
        continue;
      }
      steps.push({ automation: a, status: a.channel === "tracker" ? "logged" : "sent", at: ctx.now });
    }
    return steps;
  }

  const api = { PLANS, CATEGORIES, CATALOG, unlocked, unlockedBy, render, sendTime, isOptOut, creditsLeft, plan };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AutopilotCore = api;
})(typeof window !== "undefined" ? window : globalThis);
