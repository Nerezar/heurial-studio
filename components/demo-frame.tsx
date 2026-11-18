import { Icon } from "./icon";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Demo = {
  /** The page under public/, e.g. "demo/tracker/index.html". It loads its own files by absolute path (/tracker/*,
      /clipdesk/*), so they resolve the same inside this frame as full screen. */
  file?: string;
  title?: string;
  /** What the address bar shows. */
  address?: string;
  /** The page has its own data mode and needs telling to use sample data (?sample=1 full screen). */
  sample?: boolean;
};

/** An app demo, embedded. Sample data only; a full-screen link is always offered.
    Catalyst adds X-Frame-Options: DENY to hosted files. srcDoc renders the same local-only demo without
    navigating the frame to a blocked response. */
export function DemoFrame({ file = "demo/tracker/index.html", title = "Follow-up tracker demo with sample data", address = "heurial.studio/admin", sample = false }: Demo) {
  const src = `/${file}?v=${process.env.TRACKER_VERSION}${sample ? "&sample=1" : ""}`;
  const base = `/${file.slice(0, file.lastIndexOf("/") + 1)}`;
  const html = readFileSync(join(process.cwd(), "public", file), "utf8")
    .replace("<head>", `<head><base href="${base}"><script>window.__TV = ${JSON.stringify(process.env.TRACKER_VERSION)};${sample ? " window.__SAMPLE = true;" : ""}</script>`);
  return <div className="demo-frame" data-no-reveal>
    <div className="demo-frame-bar">
      <span aria-hidden="true"><i /><i /><i /></span>
      <p>{address} <small>· demo with made-up data</small></p>
      <a href={src} target="_blank" rel="noopener" aria-label="Open the demo full screen (opens in a new tab)">Full screen <Icon name="diagonal" size={14} /></a>
    </div>
    <div className="demo-frame-body">
      <iframe srcDoc={html} title={title} loading="lazy" />
    </div>
  </div>;
}
