// Local stand-in for the Catalyst "pipeline" function: the real handler with an in-memory store and sample data.
// Data resets on restart. For development only; never deploy this file's server.
//
//   PIPELINE_KEY=some-local-key node dev-server.js        → http://127.0.0.1:4600/
//
// Then run the site with PIPELINE_FUNCTION_URL=http://127.0.0.1:4600/ and PIPELINE_FUNCTION_KEY=some-local-key.

const http = require("node:http");
const { handle } = require("./handler");
const { memoryStore } = require("./store");
const core = require("./core");

const key = process.env.PIPELINE_KEY;
if (!key || key.length < 16) { console.error("Set PIPELINE_KEY (16+ characters)."); process.exit(1); }

const today = core.todayIn("America/Chicago");
const day = (n) => core.addDays(today, n);
const lead = (name, business, source, status, ago, value, extra = {}) => ({
  name, business, email: `${name.split(" ")[0].toLowerCase()}@example.com`, source, status,
  booked_at: day(-ago), call_at: day(-Math.max(0, ago - 2)), follow_up_at: "", follow_up_note: "",
  value_cents: value * 100, notes: "", inquiry_id: "", ...extra,
});

// Made-up sample people.
const store = memoryStore({
  Leads: [
    lead("Dana Whitfield", "Whitfield Plumbing", "Personal network", "paid", 44, 495),
    lead("Marcus Bell", "Bell Fitness Studio", "Referral", "paid", 36, 495),
    lead("Greg Haldane", "Haldane Roofing", "Referral", "paid", 26, 1200, { follow_up_at: day(10), follow_up_note: "Ask for a testimonial" }),
    lead("Ben Carter", "Carter Law Office", "Website", "proposal", 20, 1500, { follow_up_at: day(-3), follow_up_note: "Check if he's reviewed the proposal" }),
    lead("Elena Petrova", "Petrova Bookkeeping", "Partner", "proposal", 13, 1200, { follow_up_at: day(0), follow_up_note: "Send the revised scope" }),
    lead("Chris Doyle", "Doyle Electric", "Instagram", "held", 9, 0, { follow_up_at: day(2), follow_up_note: "Ask about the booking inbox" }),
    lead("Owen Pike", "Pike Landscaping", "Cold outreach", "lost", 15, 0),
    lead("Hannah Cho", "Cho Photography", "Instagram", "no_show", 12, 0),
    lead("Ryan Kowalski", "Kowalski Cleaning", "Cold outreach", "booked", 6, 0, { call_at: day(-2) }),
    lead("Grace Lindqvist", "Lindqvist Interiors", "Website", "booked", 1, 0, { call_at: day(2) }),
  ],
  Inquiries: [
    { inquiry_id: "aaaaaaaa-0000-4000-8000-000000000001", created_at: new Date(Date.now() - 5 * 36e5).toISOString(),
      name: "Ivy Romero", email: "ivy@example.com", company: "Ivy Lane Salon", source: "Instagram",
      source_detail: "tracking link ?src=instagram", heard: "", attribution: "{}", status: "new",
      message: "Booking requests come in through DMs and I miss half of them. Can you help?" },
    { inquiry_id: "aaaaaaaa-0000-4000-8000-000000000002", created_at: new Date(Date.now() - 26 * 36e5).toISOString(),
      name: "Sam Ortiz", email: "sam@example.com", company: "Ortiz HVAC", source: "Search",
      source_detail: "came from google.com", heard: "", attribution: "{}", status: "new",
      message: "We answer the same 10 questions every day on the phone." },
  ],
});
// Time on the paid jobs, so "earned per hour" has numbers.
store.list("Leads").then(async (rows) => {
  for (const r of rows.filter((x) => x.status === "paid")) {
    await store.insert("TimeEntries", { lead_id: r.ROWID, entry_date: day(-20), hours: 4, note: "Build and testing" });
    await store.insert("TimeEntries", { lead_id: r.ROWID, entry_date: day(-18), hours: 2, note: "Handoff and guide" });
  }
});

const sent = [];
http.createServer((req, res) => handle(req, res, {
  expectedKey: key, store, timeZone: "America/Chicago", digestTo: "owner@example.com", trackerUrl: "http://127.0.0.1:3007/admin",
  sendMail: async (m) => { sent.push(m); console.log(`[dev] would email ${m.to}: ${m.subject}`); },
})).listen(4600, "127.0.0.1", () => console.log("pipeline dev server on http://127.0.0.1:4600/"));
