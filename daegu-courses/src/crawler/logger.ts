import type { Logger } from "./types";

export function createLogger(prefix: string): Logger {
  const fmt = (level: string, msg: string, meta?: Record<string, unknown>) => {
    const ts = new Date().toISOString();
    const m = meta ? " " + JSON.stringify(meta) : "";
    return `[${ts}] ${level} ${prefix} ${msg}${m}`;
  };
  return {
    info: (msg, meta) => console.log(fmt("INFO ", msg, meta)),
    warn: (msg, meta) => console.warn(fmt("WARN ", msg, meta)),
    error: (msg, meta) => console.error(fmt("ERROR", msg, meta)),
  };
}
