"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";

const MotionContext = createContext<((href: string) => boolean) | null>(null);
const reducedMotion = "(prefers-reduced-motion: reduce)";
const prefersReduced = () => window.matchMedia(reducedMotion).matches;

const COVER_IN = { duration: 420, easing: "cubic-bezier(.76, 0, .24, 1)" };
const COVER_OUT = { duration: 620, easing: "cubic-bezier(.76, 0, .24, 1)" };
const MAX_WAIT = 4000;

// Blocks that rise into view. Nested matches are skipped so a card moves as one piece.
const REVEAL = "h2, h3, p, li, figure, article, .button, .glass, .note";
const REVEAL_SKIP = ".hero-visual, dialog, [data-no-reveal]";

/** Page changes (cover wipe), sticky-header state, and scroll reveal for the whole site. */
export function RouteMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const cover = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);
  const busy = useRef(false);
  const arrived = useRef<(() => void) | null>(null);
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

  // Tell a pending navigation that the new page has rendered.
  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (arrived.current) {
      arrived.current();
      return;
    }
    // Back/forward buttons: no wipe, just a gentle fade so the swap isn't abrupt.
    if (!prefersReduced()) {
      document.getElementById("main")?.animate(
        [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }],
        { duration: 450, easing: "cubic-bezier(.22, .75, .25, 1)" },
      );
    }
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
        el.style.transitionDelay = `${Math.min(order++ * 70, 350)}ms`;
        el.classList.add("is-visible");
        observer.unobserve(el);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: .12 });

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

  const navigate = useCallback((href: string) => {
    const panel = cover.current;
    const main = document.getElementById("main");
    const url = new URL(href, window.location.href);
    if (!panel || !main || busy.current || prefersReduced() || !panel.animate ||
        url.origin !== window.location.origin || url.pathname === window.location.pathname) return false;

    busy.current = true;
    const run = async () => {
      // 1. Old page sinks away while the panel wipes up over it.
      panel.classList.add("is-active");
      const leave = main.animate(
        [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-16px)" }],
        { duration: 320, easing: "ease-in", fill: "forwards" },
      );
      await panel.animate(
        [{ transform: "translateY(101%)" }, { transform: "translateY(0)" }],
        { ...COVER_IN, fill: "forwards" },
      ).finished;

      // 2. Swap pages behind the panel.
      panel.classList.add("is-waiting");
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(done, MAX_WAIT);
        function done() {
          window.clearTimeout(timer);
          arrived.current = null;
          resolve();
        }
        arrived.current = done;
        router.push(url.pathname + url.search + url.hash, { scroll: false });
      });
      panel.classList.remove("is-waiting");
      window.scrollTo({ top: 0, behavior: "instant" });
      leave.cancel();

      // 3. Panel pulls away upward and the new page rises in.
      main.animate(
        [{ opacity: 0, transform: "translateY(28px)" }, { opacity: 1, transform: "none" }],
        { duration: 700, delay: 140, easing: "cubic-bezier(.22, .75, .25, 1)", fill: "backwards" },
      );
      await panel.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(-101%)" }],
        { ...COVER_OUT, fill: "forwards" },
      ).finished;
      panel.getAnimations().forEach((animation) => animation.cancel());
      panel.classList.remove("is-active");
    };

    run().catch(() => {
      panel.getAnimations().forEach((animation) => animation.cancel());
      main.getAnimations().forEach((animation) => animation.cancel());
      panel.classList.remove("is-active", "is-waiting");
      if (window.location.pathname !== url.pathname) router.push(url.pathname + url.search + url.hash);
    }).finally(() => { busy.current = false; });
    return true;
  }, [router]);

  return <MotionContext.Provider value={navigate}>
    {children}
    <div ref={cover} className="route-cover" aria-hidden="true" />
  </MotionContext.Provider>;
}

type MotionLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function MotionLink({ href, onNavigate, ...props }: MotionLinkProps) {
  const navigate = useContext(MotionContext);
  return <Link {...props} href={href} onNavigate={(event) => {
    onNavigate?.(event);
    if (onNavigate || props.replace || props.scroll === false) return;
    if (navigate?.(href)) event.preventDefault();
  }} />;
}
