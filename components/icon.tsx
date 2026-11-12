import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  arrow: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
  diagonal: <path d="M6 18 18 6M8 6h10v10" />,
  chart: <><path d="M4 4v16h16M7 15l4-4 3 2 5-6" /><path d="M15 7h4v4" /></>,
  workflow: <><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4m-6 4v-4h12v4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  funnel: <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  spark: <path d="M12 2c.7 6 3.3 8.6 9 10-5.7 1.4-8.3 4-9 10-.7-6-3.3-8.6-9-10 5.7-1.4 8.3-4 9-10Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  book: <><path d="M6 4h13v16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 14c0-1.1.9-2 2-2h13M8 8h7" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  send: <path d="m3 10 18-7-7 18-3-8-8-3Zm8 3L21 3" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  repeat: <><path d="M4 11V9a3 3 0 0 1 3-3h12m-3-3 3 3-3 3" /><path d="M20 13v2a3 3 0 0 1-3 3H5m3 3-3-3 3-3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  pause: <path d="M8 5v14M16 5v14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  shield: <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2.2 2.2L15 10.5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  chat: <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2V6Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  form: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.3c1.9.8 3 2.9 3 5.7" /></>,
  play: <path d="M7 5v14l12-7L7 5Z" />,
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
