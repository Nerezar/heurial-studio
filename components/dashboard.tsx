"use client";

import { useId, useState } from "react";
import { Icon } from "./icon";

const periods = {
  "30 days": { revenue: "$84,620", open: "$248,500", won: "28%", points: [34, 40, 37, 47, 43, 52, 51, 61, 58, 69, 64, 76, 79, 89], funnel: [124, 78, 44, 35], labels: ["Week 1", "Week 2", "Week 3", "Week 4"] },
  "90 days": { revenue: "$231,480", open: "$612,900", won: "30%", points: [29, 38, 33, 41, 49, 45, 57, 55, 62, 68, 64, 75, 80, 91], funnel: [355, 210, 147, 107], labels: ["Month 1", "Month 2", "Month 3"] },
};

const views = [
  { title: "Overview", icon: "grid" },
  { title: "Pipeline", icon: "funnel" },
  { title: "Signals", icon: "target" },
] as const;

export function Dashboard() {
  const [period, setPeriod] = useState<keyof typeof periods>("30 days");
  const [view, setView] = useState<(typeof views)[number]["title"]>("Overview");
  const gradient = useId();
  const data = periods[period];
  const coordinates = data.points.map((value, index) => `${index * 48},${130 - value * 1.3}`).join(" ");
  const stages = ["Qualified", "Discovery", "Proposal", "Closed won"];

  return <div className="dashboard" id="demo">
    <div className="dash-top"><span className="dash-product"><Icon name="grid" size={15} /> HEURIAL / INTELLIGENCE</span><span className="demo-badge"><i /> Interactive demo</span></div>
    <div className="dash-layout">
      <nav className="dash-side" aria-label="Dashboard views">
        <span className="mono dash-label">WORKSPACE</span>
        {views.map(({ title, icon }) => <button type="button" key={title} aria-pressed={view === title} onClick={() => setView(title)}><Icon name={icon} size={16} /> {title}</button>)}
        <span className="dash-side-foot mono">SAMPLE DATA</span>
      </nav>
      <div className="dash-main">
        <div className="dash-title"><div><p className="mono dash-label">REVENUE INTELLIGENCE</p><h3>{view === "Overview" ? "Revenue overview" : view === "Pipeline" ? "Pipeline stages" : "Revenue signals"}</h3></div>
          <label className="dash-period"><span className="sr-only">Reporting period</span><select value={period} onChange={(event) => setPeriod(event.target.value as keyof typeof periods)}><option>30 days</option><option>90 days</option></select></label>
        </div>
        <div className="dash-result" aria-live="polite">
          {view === "Overview" && <>
            <div className="kpis">{[["Closed revenue", data.revenue], ["Open pipeline", data.open], ["Qualified-to-won", data.won]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
            <figure className="chart"><figcaption>Revenue trend <span>Illustrative index</span></figcaption>
              <svg viewBox="0 0 624 136" preserveAspectRatio="none" role="img" aria-label={`Sample revenue index rises from ${data.points[0]} to ${data.points.at(-1)} over ${period}`}>
                <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#3478F6" stopOpacity=".32" /><stop offset="1" stopColor="#3478F6" stopOpacity=".02" /></linearGradient></defs>
                {[14, 44, 74, 104, 134].map((y) => <line key={y} x1="0" x2="624" y1={y} y2={y} stroke="#202b3d" strokeDasharray="3 4" />)}
                <polygon points={`0,135 ${coordinates} 624,135`} fill={`url(#${gradient})`} />
                <polyline points={coordinates} fill="none" stroke="#6a9fff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
              </svg><div className="axis" aria-hidden="true">{data.labels.map((label) => <span key={label}>{label}</span>)}</div>
            </figure>
          </>}
          {view === "Pipeline" && <div className="pipeline">{stages.map((stage, index) => <div key={stage}><p><span>{stage}</span><strong>{data.funnel[index]} deals</strong></p><div className="track"><span style={{ width: `${100 * data.funnel[index] / data.funnel[0]}%` }} /></div></div>)}</div>}
          {view === "Signals" && <div className="signals">
            <div><Icon name="target" /><div><strong>Review the proposal handoff</strong><p>{data.funnel[1] - data.funnel[2]} fewer sample deals reached proposal than discovery. Check stage criteria before attributing the gap to follow-up.</p></div></div>
            <div><Icon name="chart" /><div><strong>Validate the close rate</strong><p>{data.won} of qualified sample deals reached closed won in the selected period. Compare like-for-like cohorts before acting.</p></div></div>
          </div>}
        </div>
      </div>
    </div>
  </div>;
}
