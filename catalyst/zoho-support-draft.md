# Message for Zoho Catalyst support (draft, not sent)

For the owner to send from the Catalyst console's support form or to support@zohocatalyst.com.

---

Subject: Slate (Next.js): cold starts went from 2 s to 8-30 s on 14 Nov, and the page cache fails in Production

Project: Project-Rainfall (141722000000014024), US data center. Slate app `heurial`, Production deployment `default`
(13796000000005003), function `slate-13796000000005003` (151260000000016002), custom domain www.heurial.studio.

1. Since 14 Nov 2026 about 12:00 UTC, starting a new instance takes 8-30 s instead of 2 s.
   From the function's logs (a request reaching the gateway to that request's first log line, on a new instance):
   13 Nov 16:00 UTC to 14 Nov 12:00 UTC, 1.7-2.0 s on all 36 cold starts; since 14 Nov 12:00 UTC, 7.6-29 s on all 17.
   Requests that wait more than 30 s get a 524 or 503 from your gateway. Warm requests on the same build went from
   about 100 ms to about 350 ms of execution at the same time. We deployed nothing between 08:30 and 15:05 UTC that
   day and changed no settings. Memory is 2048 MB. The Development deployment `launch` (15816000000005004, a build
   from 11 Nov) is just as slow, at 2048 MB and at 256 MB.
   Examples: request 1794657965098_420 (14 Nov 12:06 UTC, first log line 8.4 s after it arrived); a request to `/`
   at 18:27:13 UTC that the gateway answered with 524 after 30.2 s.
   Has something changed in instance start-up since then?

2. In Production every page render logs this error, and every response carries `x-nextjs-cache: MISS`:

       Failed to set cache Error: Org identifier given is not valid
         at getBucketSignature (file:///catalyst/default/open-next.config.mjs:10522:10)
         at async getHeaders2 (file:///catalyst/default/open-next.config.mjs:10551:22)
         at async Object.putObject (file:///catalyst/default/open-next.config.mjs:10586:19)
         at async Object.set (file:///catalyst/default/open-next.config.mjs:10673:3)
         at async T.set (/catalyst/default/cache.cjs:2:6426)

   The app was created and is deployed with `catalyst deploy slate heurial --production` (CLI 1.29.1). The
   Development deployment, uploaded from the console, does not log this and returns `x-nextjs-cache: HIT`.

3. Is there a way to keep one Slate instance running, or to lengthen the 5-minute idle limit?
