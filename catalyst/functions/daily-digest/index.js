// Catalyst Job function: sends the HEURIAL daily email.
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

		const res = await fetch(`${base}/digest`, {
			method: "POST",
			headers: { "X-Heurial-Key": key },
			signal: AbortSignal.timeout(30_000),
		});
		const body = await res.text();
		if (!res.ok) throw new Error(`pipeline answered ${res.status}: ${body.slice(0, 200)}`);
		console.log("Daily email sent:", body.slice(0, 200));
		context.closeWithSuccess();
	} catch (err) {
		console.error("Daily email failed:", err && err.message);
		context.closeWithFailure();
	}
};
