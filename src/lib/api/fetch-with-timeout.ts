export class FetchTimeoutError extends Error {
  constructor() {
    super("FETCH_TIMEOUT");
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new FetchTimeoutError();
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}
