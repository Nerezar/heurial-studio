// Sample data for demo mode only. Every name here is made up.
const pad = (n) => String(n).padStart(2, "0");
const daysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const people = [
  // name, business, source, status, booked days ago, value $, hours logged
  ["Dana Whitfield", "Whitfield Plumbing", "Personal network", "paid", 58, 495, 9.5],
  ["Marcus Bell", "Bell Fitness Studio", "Referral", "paid", 51, 495, 11],
  ["Priya Natarajan", "Natarajan Accounting", "Cold outreach", "lost", 49, 0, 1],
  ["Tom Okafor", "Okafor Realty", "Personal network", "paid", 44, 495, 8],
  ["Lena Ruiz", "Ruiz Salon", "Cold outreach", "no_show", 41, 0, 0],
  ["Greg Haldane", "Haldane Roofing", "Referral", "paid", 36, 1200, 14],
  ["Sofia Marchetti", "Marchetti Bakery", "Social media", "lost", 33, 0, 1.5],
  ["Ben Carter", "Carter Law Office", "Website", "proposal", 29, 1500, 2],
  ["Aisha Rahman", "Rahman Dental", "Referral", "paid", 27, 1500, 16],
  ["Owen Pike", "Pike Landscaping", "Cold outreach", "lost", 25, 0, 1],
  ["Hannah Cho", "Cho Photography", "Social media", "no_show", 22, 0, 0],
  ["Victor Alvarez", "Alvarez HVAC", "Partner", "paid", 20, 1200, 12],
  ["Mia Fontaine", "Fontaine Yoga", "Website", "held", 17, 0, 1],
  ["Jamal Reed", "Reed Auto Repair", "Cold outreach", "lost", 15, 0, 1],
  ["Elena Petrova", "Petrova Bookkeeping", "Partner", "proposal", 13, 1200, 2.5],
  ["Chris Doyle", "Doyle Electric", "Personal network", "held", 11, 0, 1],
  ["Naomi Fischer", "Fischer Pet Grooming", "Referral", "booked", 6, 0, 0],
  ["Ryan Kowalski", "Kowalski Cleaning", "Cold outreach", "booked", 4, 0, 0],
  ["Grace Lindqvist", "Lindqvist Interiors", "Website", "booked", 2, 0, 0],
  ["Dev Malhotra", "Malhotra Insurance", "Partner", "booked", 1, 0, 0],
];

export function seedDemo(db) {
  const insertLead = db.prepare(`INSERT INTO leads (name,business,email,source,status,booked_at,call_at,value_cents,notes)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  const insertTime = db.prepare("INSERT INTO time_entries (lead_id, entry_date, hours, note) VALUES (?,?,?,?)");
  const notes = {
    paid: "After-hours inquiry reply and lead log built in their own tools.",
    lost: "Liked it, wasn't ready to spend.",
    proposal: "Waiting on a yes.",
    no_show: "Didn't join the call. Re-sent the link.",
    held: "Good call. Following up this week.",
    booked: "",
  };
  // Follow-ups relative to today (negative = overdue) so the demo always shows every reminder state.
  const followUps = {
    "Ben Carter": [-3, "Check if he's reviewed the proposal"],
    "Elena Petrova": [0, "Send the revised scope"],
    "Chris Doyle": [2, "Ask about the booking inbox"],
    "Mia Fontaine": [5, "Share a sample FAQ assistant"],
    "Aisha Rahman": [14, "Ask for a testimonial"],
  };
  const setFollowUp = db.prepare("UPDATE leads SET follow_up_at = ?, follow_up_note = ? WHERE id = ?");
  people.forEach(([name, business, source, status, ago, value, hours], i) => {
    const booked = daysAgo(ago);
    const call = daysAgo(Math.max(0, ago - 2));
    const email = `${name.split(" ")[0].toLowerCase()}@example.com`;
    const { lastInsertRowid: id } = insertLead.run(name, business, email, source, status, booked, call, value * 100, notes[status]);
    if (followUps[name]) setFollowUp.run(daysAgo(-followUps[name][0]), followUps[name][1], Number(id));
    if (hours > 0) {
      const parts = hours > 4 ? 3 : 1;
      for (let p = 0; p < parts; p++) {
        insertTime.run(Number(id), daysAgo(Math.max(0, ago - 2 - p * 2 - (i % 2))), +(hours / parts).toFixed(1), p === 0 ? "Call and scoping" : p === 1 ? "Build and testing" : "Handoff and guide");
      }
    }
  });
}
