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
    const desktop = window.matchMedia("(min-width: 861px)");
    const closeOnDesktop = () => {
      if (desktop.matches) menu.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const close = () => menu.current?.close();

  return <>
    <nav className="nav-links" aria-label="Main navigation">
      {links.map(({ href, label }) => <MotionLink key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</MotionLink>)}
    </nav>
    <button
      className="nav-menu"
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
    <dialog id="mobile-menu" className="nav-dialog" ref={menu} aria-labelledby="menu-heading" onClose={() => setOpen(false)}>
      <div className="nav-dialog-head">
        <p id="menu-heading">Menu</p>
        <button className="nav-close" type="button" autoFocus onClick={close}>Close <Icon name="close" size={16} /></button>
      </div>
      <nav aria-label="Main navigation">
        {links.map(({ href, label }) =>
          <MotionLink key={href} href={href} aria-current={path === href ? "page" : undefined} onClick={close}>
            {label}
            <Icon name="diagonal" size={20} />
          </MotionLink>
        )}
      </nav>
      <MotionLink href="/contact" className="button primary" onClick={close}>Book a free call<Icon name="arrow" size={17} /></MotionLink>
    </dialog>
  </>;
}
