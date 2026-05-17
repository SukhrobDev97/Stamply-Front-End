export type StamplyDebugEntry = {
  at: string;
  message: string;
};

const MAX_ENTRIES = 24;
const entries: StamplyDebugEntry[] = [];

function timestamp() {
  return new Date().toISOString().slice(11, 19);
}

export function isStamplyDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "development") return true;
  try {
    if (localStorage.getItem("stamply_debug") === "1") return true;
    if (new URLSearchParams(window.location.search).has("debug")) return true;
  } catch {
    // ignore
  }
  return false;
}

export function stamplyDebugLog(message: string) {
  const row: StamplyDebugEntry = { at: timestamp(), message };
  entries.unshift(row);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  try {
    console.info(`[stamply] ${message}`);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event("stamply:debug-log"));
  } catch {
    // ignore
  }
}

export function getStamplyDebugEntries(): StamplyDebugEntry[] {
  return [...entries];
}
