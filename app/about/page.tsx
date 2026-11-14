import type { Metadata } from "next";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { ButtonLink, Chip, Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "About",
  description: "HEURIAL Studio is a small AI workflow studio founded by Uriyah Moore. Practical tools, built around how you already work.",
};

const principles = [
  { icon: "search", title: "Start with how it works today.", body: "Before I build anything, I map the task: who does it, which tools it touches, and where it slows down." },
  { icon: "check", title: "Prove it on real work.", body: "I test on real examples from your business, including the awkward ones, and add a human check wherever a mistake would matter." },
  { icon: "book", title: "Leave you in control.", body: "You get a plain-English guide, so you know how it works, what to check, and how to change it later." },
];

export default function About() {
  return (
    <>
      <PageIntro
        label="About"
        title="AI built around how you work."
        description="I’m Uriyah Moore, founder of HEURIAL Studio. I help small businesses use AI in practical ways: less busywork, fewer dropped balls, and tools people actually use."
      />
      <section className="section is-tight" aria-labelledby="about-method">
        <div className="wrap about-grid">
          <figure className="glass identity-plate">
            <Image src="/brand/emblem.svg" alt="HEURIAL’s tiger emblem" width={407} height={269} />
          </figure>
          <div className="about-principles">
            <header className="section-head">
              <Chip>My approach</Chip>
              <h2 id="about-method">How I work</h2>
            </header>
            <div className="note-list">
              {principles.map(({ icon, title, body }) => (
                <article className="note" key={title}>
                  <span className="icon-tile"><Icon name={icon} size={20} /></span>
                  <div><h3>{title}</h3><p>{body}</p></div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="section is-tight" aria-labelledby="about-studio-title">
        <div className="wrap">
          <div className="strip">
            <div>
              <Chip>HEURIAL Studio</Chip>
              <h2 id="about-studio-title">One task at a time.</h2>
              <p>Start with one repetitive task. I’ll build a workflow for it in your own tools in about a week.</p>
            </div>
            <ButtonLink href="/#how-it-works" secondary>See how it works</ButtonLink>
          </div>
        </div>
      </section>
      <Closing />
    </>
  );
}
