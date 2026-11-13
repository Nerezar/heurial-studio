# Saving website inquiries in Zoho Catalyst

**Status (2026-11-11):** the function `inquiries` is deployed to Project-Rainfall (Development) at
`https://project-rainfall-946299681.development.catalystserverless.com/server/inquiries/`. It is publicly reachable and
refuses requests without the key. Still to do: create the `Inquiries` table (step 1), set the secret on both sides
(step 3), and redeploy the site (step 4). Step 2 is done. The key is saved at `~/.heurial-secrets/inquiry-key`;
copy it without showing it with `pbcopy < ~/.heurial-secrets/inquiry-key`.

How it fits together:

```
Visitor fills in the contact form
  → the site's server checks every field and works out the source (Instagram, Referral, …)
  → it sends the inquiry to the Catalyst function "inquiries", with a secret key
  → the function checks the key and the fields again, then saves a row in the Data Store table "Inquiries"
```

The secret key lives only on the two servers. Visitors' browsers never see it.
If the function can't be reached, the visitor is told to try again or email hello@heurial.studio. Nothing is lost silently.

## 1. Create the table (Catalyst console)

In your Catalyst project: **CloudScale → Data Store → Create a new table** named exactly `Inquiries`.

Add these columns. All are **Text** (or **Var Char** with the length shown) and none are mandatory, except where noted:

| Column          | Type / length         | Notes                                   |
| --------------- | --------------------- | --------------------------------------- |
| `inquiry_id`    | Var Char, 36          | Unique. The reference the visitor sees. |
| `created_at`    | Var Char, 30          | ISO time, e.g. 2026-11-11T15:39:05Z     |
| `name`          | Var Char, 100         |                                         |
| `email`         | Var Char, 254         |                                         |
| `company`       | Var Char, 120         |                                         |
| `message`       | Text                  | Up to 1,200 characters                  |
| `source`        | Var Char, 60          | Instagram, Referral, Search, Direct, …  |
| `source_detail` | Var Char, 200         | How the source was decided              |
| `heard`         | Var Char, 20          | Their answer to "How did you hear…"     |
| `attribution`   | Text                  | Raw tracking data (JSON)                |
| `status`        | Var Char, 20          | Starts as `new`                         |

Then open the table's **Scopes & Permissions** and make sure **no public (end-user) role** can read or write it.
Only the function, which runs with your project's admin access, should touch it.

## 2. Add the function (Catalyst CLI)

From this folder (`heurial/catalyst`):

```sh
catalyst login
catalyst init           # pick your existing project; choose Functions
catalyst functions:add  # type: Advanced I/O, stack: Node.js, name: inquiries
```

The CLI generates a starter `functions/inquiries/` folder. Replace its `index.js`, add `handler.js`, and merge
`package.json` dependencies from this repo's `catalyst/functions/inquiries/`. Keep any config file the CLI created
(for example `catalyst-config.json`). Then:

```sh
cd functions/inquiries && npm install && cd ../..
catalyst deploy --only functions
```

## 3. Set the secret on both sides

Make one long random secret:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- **Function:** Catalyst console → Serverless → Functions → `inquiries` → Configuration → Environment Variables →
  add `INQUIRY_KEY` = the secret.
- **Website (Slate):** Catalyst console → Slate → your app → Configuration → Environment Variables →
  add `INQUIRY_FUNCTION_KEY` = the same secret, and `INQUIRY_FUNCTION_URL` = the function's URL,
  which looks like `https://<project-domain>.catalystserverless.com/server/inquiries/`.

Never paste the secret into code, chat, or git.

### Email alert for each new inquiry

Right after an inquiry is saved, the function emails the owner through Catalyst Mail: who wrote, their email and
business, where they came from, and the message. Replying to that email goes straight to the visitor. If the email
fails or takes longer than 5 seconds, the visitor's submission still succeeds and the failure shows in the function's
logs ("owner alert failed"); the daily email is the backup.

It works with no extra settings: it sends from and to `hello@heurial.studio`, which is verified in Catalyst Mail.
Optional settings on the `inquiries` function:
- `ALERT_TO`: a different address for the alerts, or `off` to stop them.
- `ALERT_FROM`: a different sender. It must be verified in Catalyst Mail first.
- `TRACKER_URL`: the link in the email (default `https://www.heurial.studio/admin`).

## 4. Redeploy the site and test

Redeploy the Slate app so it picks up the new variables. Then:

1. Open `https://www.heurial.studio/?src=referral`, go to Contact, and send a test inquiry.
2. You should see "Thanks! … Reference: …".
3. In Data Store → `Inquiries`, the new row should show `source` = Referral.
4. Within a minute, `hello@heurial.studio` should get "New inquiry: …". Delete the test row afterwards.

If the form says it couldn't reach the inbox, check the function's logs in the console and that both secret values match.

## Things to confirm on the first deploy

These follow Catalyst's current JavaScript SDK docs, but haven't been run against your project yet:

- The Advanced I/O entry point shape. If the generated template differs, keep its shape and call `handle()` the same way.
- That `new Datastore()` uses the app set up by `zcAuth.init(req)`.
- Whether Catalyst asks for a sign-in token on Advanced I/O function URLs. If it does, the function's URL needs to allow
  public access, since the secret key does the protecting.
