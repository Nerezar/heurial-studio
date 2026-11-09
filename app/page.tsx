import { Dashboard } from "@/components/dashboard";
import { Icon } from "@/components/icon";
import { MotionLink } from "@/components/route-transition";
import { ButtonLink, Closing } from "@/components/shell";
import { StudioSequence } from "@/components/studio-sequence";
import { SystemField } from "@/components/system-field";
import "./home.css";

export default function Home() {
  return <>
    <section className="studio-hero" aria-labelledby="hero-title">
      <div className="wrap studio-hero-inner">
        <div className="hero-register mono"><span><i /> Heurial Studio</span><span>Systems / Automation / AI</span></div>
        <div className="hero-field"><SystemField /></div>
        <div className="studio-hero-copy">
          <h1 id="hero-title"><span className="headline-mask"><span>Intelligence</span></span>{" "}<span className="headline-mask"><span>built for growth.</span></span></h1>
          <div className="hero-foot">
            <p>AI consulting and engineering for the work your business depends on.</p>
            <ButtonLink href="/services" secondary>Explore the Studio</ButtonLink>
          </div>
        </div>
        <a className="hero-scroll mono" href="#studio">Scroll to explore <span aria-hidden="true">↓</span></a>
      </div>
    </section>

    <section className="studio-statement" id="studio" aria-labelledby="studio-title">
      <div className="wrap statement-layout">
        <p className="mono index-label">01 / Heurial Studio</p>
        <div>
          <h2 id="studio-title">Build around the way your business works.</h2>
          <div className="statement-detail">
            <p>Heurial Studio brings consulting, automation, and AI engineering into one engagement. We work with your team to decide where to start, build the system, and plan for the people who’ll run it.</p>
            <MotionLink href="/about" className="text-link">About Heurial <Icon name="diagonal" size={16} /></MotionLink>
          </div>
        </div>
      </div>
    </section>

    <StudioSequence />

    <section className="studio-demo" aria-labelledby="showcase-title">
      <div className="wrap">
        <header className="chapter-heading">
          <p className="mono index-label">03 / Heurial Intelligence</p>
          <div>
            <h2 id="showcase-title">See where the<br />pipeline stalls.</h2>
            <p>Explore a working prototype with sample data. Switch views and reporting periods to see how it surfaces bottlenecks.</p>
            <MotionLink href="/products" className="text-link">About the demo <Icon name="diagonal" size={16} /></MotionLink>
          </div>
        </header>
        <Dashboard />
      </div>
    </section>

    <section className="wrap studio-learn" aria-labelledby="learn-title">
      <p className="mono index-label">04 / Learn</p>
      <div><h2 id="learn-title">Ask a question.<br />Follow the source.</h2>
        <p>Use the knowledge assistant to explore Studio services, the demo, or how to start a project. Each answer links back to the source.</p>
        <ButtonLink href="/resources" secondary>Open Learn</ButtonLink>
      </div>
    </section>
    <Closing />
  </>;
}
