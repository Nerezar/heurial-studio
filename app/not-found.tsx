import type { Metadata } from "next";
import { ButtonLink, Chip } from "@/components/shell";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return <section className="page-intro is-navy not-found">
    <div className="wrap page-intro-inner">
      <Chip>Page not found</Chip>
      <h1><span className="intro-title">That page isn’t here.</span></h1>
      <p className="lede">The link may be old, or the page may have moved.</p>
      <ButtonLink href="/">Back to the homepage</ButtonLink>
    </div>
  </section>;
}
