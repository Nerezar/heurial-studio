import type { CSSProperties } from "react";

/** Inline style that sets a chip, note, or icon tile's accent colour to one of the theme colours. */
export function tone(name: "signal" | "cyan" | "green" | "amber" | "red" | "violet", extra: Record<string, string | number> = {}) {
  return { "--c": `var(--${name})`, ...extra } as CSSProperties;
}
