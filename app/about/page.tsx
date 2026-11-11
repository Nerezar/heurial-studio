import Image from "next/image";
import type { Metadata } from "next";
import { ButtonLink, Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "About",
  description: "HEURIAL Studio is a small AI workflow studio founded by Uriyah Moore. Practical tools, built around how you already work.",
};

const principles = [
  { title: "Make the work visible.", body: "Start with a workflow, decision, or bottleneck. Learn who owns it, what tools it touches, and where a system could help." },
  { title: "Prove it on real work.", body: "Choose examples that reflect what your team actually sees. Use them to check output quality, edge cases, and when a person should take over." },
  { title: "Plan for ownership.", body: "Document how the system works, who responds to problems, and how your team can change it after launch." },
];

export default function About() {
  return (
    <>
      <PageIntro
        label="About"
        title="AI built around how you work."
        description="I’m Uriyah Moore, founder of HEURIAL Studio. I help small businesses use AI in practical ways: less busywork, fewer dropped balls, and tools people actually use."
      />
      <section className="interior-paper" aria-labelledby="about-method">
        <div className="wrap interior-band about-editorial">
          <figure className="identity-plate">
            <Image src="/brand/emblem.svg" alt="Heurial’s tiger emblem" width={407} height={269} />
          </figure>
          <div className="about-principles">
            <p className="interior-label">Our approach</p>
            <h2 id="about-method">How I work</h2>
            <ol>
              {principles.map(({ title, body }) => (
                <li key={title}>
                  <div><h3>{title}</h3><p>{body}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section className="wrap interior-band about-studio" aria-labelledby="about-studio-title">
        <div>
          <p className="interior-label">Heurial Studio</p>
          <h2 id="about-studio-title">One task at a time.</h2>
          <p>Start with one repetitive task. I’ll build a workflow for it in your own tools in about a week.</p>
        </div>
        <ButtonLink href="/services" secondary>See how it works</ButtonLink>
      </section>
      <Closing />
    </>
  );
}
