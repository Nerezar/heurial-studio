import { Icon } from "./icon";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = "/demo/tracker/index.html";
// Catalyst adds X-Frame-Options: DENY to hosted files. srcDoc renders the
// same local-only demo without navigating the frame to a blocked response.
const DEMO_HTML = readFileSync(join(process.cwd(), "public/demo/tracker/index.html"), "utf8")
  .replace("<head>", '<head><base href="/demo/tracker/">');

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
