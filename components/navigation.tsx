"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { MotionLink } from "./route-transition";

type NavLink = { href: string; label: string };

export function Navigation({ links }: { links: NavLink[] }) {
  const path = usePathname();
  const menu = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    menu.current?.close();
  }, [path]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => {
      if (desktop.matches) menu.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return <>
    <nav className="masthead-nav" aria-label="Main navigation">
      {links.map(({ href, label }) => <MotionLink key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</MotionLink>)}
    </nav>
    <button
      className="masthead-menu"
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="mobile-menu"
      onClick={() => {
        menu.current?.showModal();
        setOpen(true);
      }}
    >
      Menu <Icon name="menu" size={18} />
    </button>
    <dialog id="mobile-menu" className="masthead-dialog" ref={menu} aria-labelledby="menu-heading" onClose={() => setOpen(false)}>
      <div className="menu-masthead">
        <p id="menu-heading" className="mono">HEURIAL / Navigation</p>
        <button className="masthead-menu" type="button" autoFocus onClick={() => menu.current?.close()}>
          Close <span aria-hidden="true">×</span>
        </button>
      </div>
      <nav aria-label="Main navigation">
        {[...links, { href: "/products", label: "Intelligence" }].map(({ href, label }, index) =>
          <MotionLink key={href} href={href} aria-current={path === href ? "page" : undefined} onClick={() => menu.current?.close()}>
            <span className="mono" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            {label}
            <Icon name="diagonal" size={22} />
          </MotionLink>
        )}
      </nav>
    </dialog>
  </>;
}
