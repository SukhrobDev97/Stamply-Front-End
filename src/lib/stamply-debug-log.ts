export type StamplyDebugEntry = {
  at: string;
  tag: string;
  message: string;
};

const MAX = 40;
const buffer: StamplyDebugEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const fn of [...listeners]) fn();
}

export function stamplyDebugLog(tag: string, message: string, extra?: unknown) {
  const line = extra !== undefined ? `${message} ${safeJson(extra)}` : message;
  const entry: StamplyDebugEntry = {
    at: new Date().toISOString().slice(11, 23),
    tag,
    message: line,
  };
  buffer.unshift(entry);
  if (buffer.length > MAX) buffer.length = MAX;
  if (process.env.NODE_ENV === "development") {
    console.info(`[${tag}]`, message, extra ?? "");
  }
  emit();
}

export function stamplyDebugEntries(): readonly StamplyDebugEntry[] {
  return buffer;
}

export function subscribeStamplyDebug(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function stamplyDebugCopyText(): string {
  return buffer
    .map((e) => `${e.at} [${e.tag}] ${e.message}`)
    .join("\n");
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
