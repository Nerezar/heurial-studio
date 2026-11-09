import Image from "next/image";
import type { Metadata } from "next";
import { ButtonLink, Closing, PageIntro } from "@/components/shell";
import "../interiors.css";

export const metadata: Metadata = {
  title: "About",
  description: "Learn how HEURIAL brings AI consulting, engineering, and operations together.",
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
        label="03 / About Heurial"
        title="AI built around how you work."
        description="Heurial brings consulting, engineering, and operations together to help businesses turn specific problems into systems their teams can use."
      />
      <section className="interior-paper" aria-labelledby="about-method">
        <div className="wrap interior-band about-editorial">
          <figure className="identity-plate">
            <Image src="/brand/emblem.svg" alt="Heurial’s tiger emblem" width={407} height={269} />
            <figcaption className="interior-label"><span>Heurial</span><span>Fig. 01 / Emblem</span></figcaption>
          </figure>
          <div className="about-principles">
            <p className="interior-label">Our approach</p>
            <h2 id="about-method">How we work</h2>
            <ol>
              {principles.map(({ title, body }, index) => (
                <li key={title}>
                  <span className="interior-label" aria-hidden="true">0{index + 1}</span>
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
          <h2 id="about-studio-title">From scope to handoff.</h2>
          <p>Studio is where we work with businesses to plan, build, and operate AI systems and automations.</p>
        </div>
        <ButtonLink href="/services" secondary>Explore Studio</ButtonLink>
      </section>
      <Closing />
    </>
  );
}
