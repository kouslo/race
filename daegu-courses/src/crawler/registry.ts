import type { CourseAdapter } from "./types";
import { daeguArtsCenterAdapter } from "./adapters/daegu-arts-center";

const adapters = new Map<string, CourseAdapter>();

function register(adapter: CourseAdapter) {
  if (adapters.has(adapter.key)) {
    throw new Error(`Duplicate adapter key: ${adapter.key}`);
  }
  adapters.set(adapter.key, adapter);
}

register(daeguArtsCenterAdapter);

export function getAdapter(key: string): CourseAdapter {
  const a = adapters.get(key);
  if (!a) throw new Error(`Unknown adapter key: ${key}`);
  return a;
}

export function listAdapters(): CourseAdapter[] {
  return [...adapters.values()];
}
