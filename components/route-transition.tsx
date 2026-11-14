"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Blocks that rise into view. Nested matches are skipped so a card moves as one piece.
const REVEAL = "h2, h3, p, li, figure, article, .button, .glass, .note";
const REVEAL_SKIP = ".hero-visual, dialog, [data-no-reveal]";

/** Sticky-header state, a short fade when the page changes, and scroll reveal for the whole site. */
export function RouteMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const firstReveal = useRef(true);

  // Frosted header once the page has scrolled.
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      if (window.scrollY > 8) root.dataset.scrolled = "";
      else delete root.dataset.scrolled;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // A short fade so a page change isn't abrupt. Nothing covers the page or makes the visitor wait.
  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (prefersReduced()) return;
    document.getElementById("main")?.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: 280, easing: "cubic-bezier(.22, .75, .25, 1)" },
    );
  }, [pathname]);

  // Scroll reveal, set up again for every page.
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main || prefersReduced() || !("IntersectionObserver" in window)) return;
    const initial = firstReveal.current;
    firstReveal.current = false;

    const candidates = Array.from(main.querySelectorAll<HTMLElement>(REVEAL))
      .filter((el) => !el.closest(REVEAL_SKIP));
    const chosen = new Set(candidates);
    const targets = candidates.filter((el) => {
      const parent = el.parentElement?.closest<HTMLElement>(REVEAL);
      return !parent || !chosen.has(parent);
    }).filter((el) => {
      // On first load, leave what's already on screen alone so nothing flickers.
      if (!initial) return true;
      const box = el.getBoundingClientRect();
      return box.top > window.innerHeight * .92;
    });

    const observer = new IntersectionObserver((entries) => {
      let order = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.style.transitionDelay = `${Math.min(order++ * 50, 200)}ms`;
        el.classList.add("is-visible");
        observer.unobserve(el);
      }
    }, { rootMargin: "0px 0px -6% 0px", threshold: .1 });

    for (const el of targets) {
      el.classList.add("reveal");
      observer.observe(el);
    }
    return () => {
      observer.disconnect();
      for (const el of targets) {
        el.classList.remove("reveal", "is-visible");
        el.style.transitionDelay = "";
      }
    };
  }, [pathname]);

  return children;
}
