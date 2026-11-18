// Catalyst Job function: sends the HEURIAL daily email, and runs the Autopilot tick.
// A cron with the job param path=autopilot/tick (every 5 minutes) sends what Autopilot has due; with no param it's the daily email.
// Schedule it once a day (Catalyst console → Job Scheduling: a job pool plus a daily cron that runs this job).
// It asks the "pipeline" function to build and send the email, so all the logic lives in one place.
//
// Environment variables (Catalyst console):
//   PIPELINE_FUNCTION_URL  the pipeline function's URL, e.g. https://<project-domain>.catalystserverless.com/server/pipeline/
//   PIPELINE_KEY           the same secret the pipeline function checks

/**
 * @param {import("./types/job").JobRequest} jobRequest
 * @param {import("./types/job").Context} context
 */
module.exports = async (jobRequest, context) => {
	try {
		const base = (process.env.PIPELINE_FUNCTION_URL || "").replace(/\/+$/, "");
		const key = process.env.PIPELINE_KEY;
		if (!base.startsWith("https://") || !key) throw new Error("Set PIPELINE_FUNCTION_URL (https) and PIPELINE_KEY.");

		// Only these two; anything else in the param falls back to the daily email.
		const path = jobRequest.getJobParam("path") === "autopilot/tick" ? "autopilot/tick" : "digest";
		const res = await fetch(`${base}/${path}`, {
			method: "POST",
			headers: { "X-Heurial-Key": key },
			signal: AbortSignal.timeout(30_000),
		});
		const body = await res.text();
		if (!res.ok) throw new Error(`pipeline answered ${res.status}: ${body.slice(0, 200)}`);
		console.log(`${path} done:`, body.slice(0, 200));
		context.closeWithSuccess();
	} catch (err) {
		console.error("Scheduled job failed:", err && err.message);
		context.closeWithFailure();
	}
};
