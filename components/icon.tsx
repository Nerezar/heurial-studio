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
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
