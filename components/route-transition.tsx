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

export function RouteMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const previousPath = useRef(pathname);
  const transition = useRef<ViewTransition | null>(null);
  const finishUpdate = useRef<(() => void) | null>(null);
  const entrance = useRef<Animation | null>(null);
  const navigationVersion = useRef(0);

  const cancelMotion = useCallback(() => {
    finishUpdate.current?.();
    transition.current?.skipTransition();
    entrance.current?.cancel();
  }, []);

  useEffect(() => {
    const preference = window.matchMedia(reducedMotion);
    const onPopState = () => {
      navigationVersion.current++;
      cancelMotion();
    };
    const onPreference = () => {
      if (preference.matches) cancelMotion();
    };
    window.addEventListener("popstate", onPopState);
    preference.addEventListener("change", onPreference);
    return () => {
      window.removeEventListener("popstate", onPopState);
      preference.removeEventListener("change", onPreference);
      onPopState();
    };
  }, [cancelMotion]);

  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;

    if (finishUpdate.current) {
      finishUpdate.current();
      return;
    }

    // History traversal and browsers without snapshots still reveal committed content.
    if (window.matchMedia(reducedMotion).matches) return;
    entrance.current?.cancel();
    entrance.current = document.getElementById("main")?.animate(
      [{ opacity: 0.72 }, { opacity: 1 }],
      { duration: 190, easing: "ease-out" },
    ) ?? null;
  }, [pathname]);

  const navigate = useCallback((href: string) => {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname ||
        window.matchMedia(reducedMotion).matches || !document.startViewTransition) return false;

    // Let Next handle another click normally if an earlier transition is still in progress.
    if (transition.current) {
      navigationVersion.current++;
      cancelMotion();
      return false;
    }
    entrance.current?.cancel();
    const version = ++navigationVersion.current;

    let active: ViewTransition;
    try {
      active = document.startViewTransition(() => {
        if (version !== navigationVersion.current) return;
        return new Promise<void>((resolve) => {
          const done = () => {
            window.clearTimeout(timeout);
            finishUpdate.current = null;
            resolve();
          };
          // If data is slow, release the old snapshot. Next can still finish the navigation.
          const timeout = window.setTimeout(() => {
            done();
            active.skipTransition();
          }, 600);
          finishUpdate.current = done;
          router.push(url.pathname + url.search + url.hash);
        });
      });
    } catch {
      return false;
    }

    transition.current = active;
    // Skipped transitions may reject ready even though navigation succeeded.
    void active.ready.catch(() => {});
    void active.finished.catch(() => {}).finally(() => {
      if (transition.current === active) transition.current = null;
    });
    return true;
  }, [cancelMotion, router]);

  return <MotionContext.Provider value={navigate}>{children}</MotionContext.Provider>;
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
