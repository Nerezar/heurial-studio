import { Icon } from "./icon";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = `/demo/tracker/index.html?v=${process.env.TRACKER_VERSION}`;
// Catalyst adds X-Frame-Options: DENY to hosted files. srcDoc renders the
// same local-only demo without navigating the frame to a blocked response.
const DEMO_HTML = readFileSync(join(process.cwd(), "public/demo/tracker/index.html"), "utf8")
  .replace("<head>", `<head><base href="/demo/tracker/"><script>window.__TV = ${JSON.stringify(process.env.TRACKER_VERSION)};</script>`);
// The demo page loads its styles and scripts by absolute path (/tracker/*, /demo/tracker/core.js), so they
// resolve the same way inside this frame as they do full screen.

/** The follow-up tracker demo, embedded. Sample data only; a full-screen link is always offered. */
export function DemoFrame() {
  return <div className="demo-frame" data-no-reveal>
    <div className="demo-frame-bar">
      <span aria-hidden="true"><i /><i /><i /></span>
      <p>heurial.studio/admin <small>· demo with made-up data</small></p>
      <a href={SRC} target="_blank" rel="noopener" aria-label="Open the demo full screen (opens in a new tab)">Full screen <Icon name="diagonal" size={14} /></a>
    </div>
    <div className="demo-frame-body">
      <iframe srcDoc={DEMO_HTML} title="Follow-up tracker demo with sample data" loading="lazy" />
    </div>
  </div>;
}
