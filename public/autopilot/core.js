/* HEURIAL Autopilot: the catalog, the plans and the rules every automation follows. No DOM here.
   Tested in tracker/autopilot.test.mjs.

   An automation listens for one trigger (a missed call, a paid job, a schedule) and does one thing (a text, an
   email, an AI draft, a tracker update). AI-written messages to customers wait for the owner's approval by default.
   Plans unlock automations: Starter 8, Pro 19, Business all 30. */
(function (root) {
  const PLANS = [
    { id: "starter", name: "Starter", credits: 100, note: "The basics that stop leads slipping away." },
    { id: "pro", name: "Pro", credits: 500, note: "Follow-ups, reviews and money on autopilot." },
    { id: "business", name: "Business", credits: 2000, note: "Everything, including AI content and reports." },
  ];

  const CATEGORIES = ["Leads", "Follow-up", "Appointments", "Reviews", "Money", "Reports", "Repeat business", "Website"];

  // trigger ids: missed_call, web_inquiry, email_in, proposal_quiet, lead_quiet, call_ended, lead_stale,
  // appointment_soon, appointment_missed, job_paid, review_posted, invoice_overdue, receipt_in, schedule, question
  const A = (id, name, category, plan, trigger, channel, ai, description, template = "") =>
    ({ id, name, category, plan, trigger, channel, ai, description, template });
  const CATALOG = [
    A("missed-call", "Missed-call text-back", "Leads", "starter", "missed_call", "text", false, "A missed call gets a text within a minute, and the caller becomes a lead.", "Hi {first_name}, sorry I missed your call. This is {business}. What can I help with?"),
    A("web-reply", "Instant reply to web inquiries", "Leads", "starter", "web_inquiry", "email", false, "Every website inquiry gets an answer straight away, day or night.", "Hi {first_name}, thanks for getting in touch with {business}. I'll reply properly within a few hours. If it's easier to talk, book a time here: {booking_link}"),
    A("email-lead", "Inbound email becomes a lead", "Leads", "starter", "email_in", "tracker", false, "Emails sent to your forwarding address become leads with the thread attached."),
    A("hot-alert", "Owner alert for hot leads", "Leads", "starter", "web_inquiry", "owner", false, "You get a text when a new lead asks for a quote or mentions a date.", "New lead: {first_name} wants {topic}. Reply soon."),
    A("lead-source", "Lead source tracking", "Leads", "pro", "web_inquiry", "tracker", false, "Every lead is tagged with where it came from, so you know which ads and pages pay."),
    A("quote-followup", "Quote follow-up sequence", "Follow-up", "pro", "proposal_quiet", "email", true, "A quote with no reply gets a nudge on day 2, 5 and 10, each written for that customer."),
    A("revive", "Revive quiet leads", "Follow-up", "pro", "lead_quiet", "email", true, "Leads that went quiet get a short, personal check-in at 30, 60 and 90 days."),
    A("call-recap", "Post-call recap email", "Follow-up", "pro", "call_ended", "email", true, "After a call, a recap of what you agreed and the next step is drafted for you."),
    A("stale-cleanup", "Stale lead cleanup", "Follow-up", "business", "lead_stale", "tracker", false, "Leads with no activity in 120 days are closed with a reason, so your board stays honest."),
    A("reminders", "Appointment reminders", "Appointments", "starter", "appointment_soon", "text", false, "A text the day before every appointment, with the time and address.", "Hi {first_name}, a reminder from {business}: see you {when}. Reply C to confirm or R to reschedule."),
    A("confirm", "Confirm or reschedule by text", "Appointments", "starter", "appointment_soon", "text", false, "Customers reply C to confirm or R to get your booking link. Their answer lands on the appointment."),
    A("no-show", "No-show follow-up", "Appointments", "pro", "appointment_missed", "text", false, "A missed appointment gets a friendly text with a link to book again.", "Hi {first_name}, sorry we missed you today. Pick a new time here: {booking_link}"),
    A("booking-link", "Booking link in every reply", "Appointments", "pro", "web_inquiry", "email", false, "Your booking link is added to every first reply, so people can skip the back and forth."),
    A("review-ask", "Review request after a paid job", "Reviews", "starter", "job_paid", "text", false, "Every paid customer gets a thank-you and a link to leave a Google review.", "Thanks for choosing {business}, {first_name}. If you have a minute, a review helps a lot: {review_link}"),
    A("review-reply", "Review reply drafts", "Reviews", "pro", "review_posted", "owner", true, "Each new review gets a reply drafted in your voice, ready for you to post."),
    A("testimonial", "Testimonial collector", "Reviews", "business", "review_posted", "email", false, "Customers who leave 5 stars are asked if you can quote them on your site.", "Thank you for the kind review, {first_name}. Would you mind if I quoted it on my website?"),
    A("invoice-chase", "Invoice reminders", "Money", "pro", "invoice_overdue", "email", false, "Overdue invoices get polite reminders at 3, 7 and 14 days, then you're told.", "Hi {first_name}, a quick reminder that invoice {invoice} for {amount} is now due. You can pay here: {pay_link}"),
    A("paid-thanks", "Thank-you when a payment comes in", "Money", "pro", "job_paid", "email", false, "A receipt and a thank-you go out as soon as a payment lands.", "Thanks, {first_name}. I've received {amount}. It was a pleasure working with you."),
    A("receipts", "Receipt sorter", "Money", "business", "receipt_in", "tracker", true, "Forward a receipt to your address and it's filed under the right expense."),
    A("expense-summary", "Monthly expense summary", "Money", "business", "schedule", "owner", false, "On the 1st, where your money went last month, by category."),
    A("daily-brief", "Daily briefing", "Reports", "starter", "schedule", "owner", false, "Every morning: new leads, follow-ups due, appointments and anything waiting on you."),
    A("weekly-numbers", "Weekly numbers email", "Reports", "pro", "schedule", "owner", false, "Every Monday: calls, leads, jobs won, revenue and reviews, against the week before."),
    A("monthly-report", "Monthly owner report", "Reports", "business", "schedule", "owner", true, "A one-page summary of the month, written in plain English, with what to fix next."),
    A("birthdays", "Birthday and anniversary notes", "Repeat business", "business", "schedule", "email", false, "A short note on a customer's birthday or the anniversary of their first job.", "Happy birthday from everyone at {business}, {first_name}."),
    A("referral", "Referral ask after a good review", "Repeat business", "business", "review_posted", "email", false, "Happy customers are asked, once, if they know anyone who could use you.", "Thanks again, {first_name}. If you know anyone who could use {business}, I'd be grateful for the introduction."),
    A("rebook", "Re-book reminders", "Repeat business", "pro", "schedule", "text", false, "Customers due for their next visit, like a yearly service, get a text with your booking link.", "Hi {first_name}, it's about time for your next visit with {business}. Book here: {booking_link}"),
    A("seasonal", "Seasonal campaign drafts", "Repeat business", "business", "schedule", "email", true, "Before each season, a campaign email to past customers is drafted for you to approve."),
    A("site-assistant", "Website assistant", "Website", "business", "question", "web", true, "A chat on your site answers questions from your FAQ and books calls. It hands anything else to you."),
    A("social-drafts", "Social post drafts from finished jobs", "Website", "business", "job_paid", "owner", true, "A finished job becomes a social post draft, ready for your photos."),
    A("gbp-posts", "Google Business Profile posts", "Website", "business", "schedule", "owner", true, "A weekly post for your Google profile is drafted from your recent work."),
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
      if (a.channel === "text" && ctx.contact.optedOut) { steps.push({ automation: a, status: "skipped", reason: "Opted out of texts" }); continue; }
      if (a.ai && credits <= 0) { steps.push({ automation: a, status: "waiting", reason: "No AI drafts left this month" }); continue; }
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
