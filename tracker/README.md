# HEURIAL Pipeline

A private tracker for booked calls, paid jobs, hours worked, and where each client came from.
No dependencies and no sign-in. It runs only on your own computer.

## Run it

Needs Node 22.13 or newer (check with `node -v`).

```sh
cd heurial-tracker
npm start          # your real data   -> http://127.0.0.1:4310
npm run demo       # sample data only -> http://127.0.0.1:4311
```

Demo mode uses a separate database, so sample data never mixes with real clients.

## Where your data lives

`~/.heurial-tracker/tracker.db` (a SQLite file in your home folder, outside iCloud-synced Documents).
Back it up by copying that file, or use **Export CSV** in the app.
Set `TRACKER_DIR` to keep it somewhere else.

## Views

- **Overview**: summary cards with arrows comparing against the previous period, the "Needs you" list of follow-ups,
  the funnel (booked → showed up → proposal → paid), calls per week, revenue over 12 weeks, results by source,
  and what each paid job earned per hour.
- **Pipeline**: a board with one column per status. Drag a card to move it (press and hold first on a phone),
  or click it to open its details.
- **Clients**: a searchable list of everyone who booked a call in the chosen period.

Clicking any person opens a side panel with their status, contact details, deal, follow-up, notes and logged time.
The sun/moon button switches between light and dark mode, and the choice is remembered.

## What it tracks

- **Calls**: name, business, email, source, status (booked, held, proposal, paid, lost, no-show), dates, value, notes.
- **Time**: hours per client with a short note on what you did.
- **Dashboard** for 7 days, 30 days, 90 days, 12 months, or all time: calls booked, held, paid, close rate, revenue, hours,
  hours per paid job, revenue per hour, results by source, and a weekly trend.

## Reminders

The **Follow-ups** panel sits under the summary numbers and always shows what needs you now, whatever date range is selected:

- **Did these calls happen?** Calls whose date has passed but are still marked "booked". One click marks them held or no-show.
- **Follow-ups due within 7 days**, with overdue ones in red. Each has **Done**, **+1 day** and **+1 week**.
- Set a **Follow up on** date and a short reminder on any call. Changing a status to held, proposal sent or paid suggests one automatically (3, 3 and 14 days out), only into empty fields.
- The browser tab title shows a count, like `(3) HEURIAL Pipeline`, when something is overdue or due today.

Reminders only show while the tracker page is open. They don't send emails or notifications.
Older databases pick up the new follow-up fields automatically the first time you start the app.

## Privacy

It listens only on `127.0.0.1`, rejects requests from other websites and hostnames, and the CSV export guards against spreadsheet formula injection.
Don't put it on a public server without adding sign-in first.
