export function isRecoverableStamplyAuthMessage(message: string | undefined | null): boolean {
  const u = String(message ?? "").toUpperCase();
  if (u.includes("MEMBERSHIP_NOT_FOUND")) return true;
  if (u.includes("MISSING") && u.includes("BUSINESS_ID")) return true;
  if (u.includes("BUSINESS NOT FOUND FOR CURRENT USER")) return true;
  return false;
}

export function profileApolloErrorOnlyRecoverable(err: unknown): boolean {
  const e = err as { graphQLErrors?: readonly { message?: string }[] };
  const list = e?.graphQLErrors ?? [];
  if (list.length === 0) return false;
  return list.every((x) => isRecoverableStamplyAuthMessage(x?.message));
}

export function shouldInvalidateStamplySession(messages: string[], httpStatus: number | undefined): boolean {
  if (messages.some((m) => isRecoverableStamplyAuthMessage(m))) return false;
  if (httpStatus === 401) return true;
  const joined = messages.join(" ").toLowerCase();
  if (joined.includes("session outdated")) return true;
  if (joined.includes("jwt expired") || joined.includes("token expired")) return true;
  if (joined.includes("invalid token") || joined.includes("invalid signature")) return true;
  if (messages.some((m) => String(m).includes("Unauthorized"))) return true;
  return false;
}

export function shouldDestroySessionForProfileError(err: unknown): boolean {
  if (!err) return false;
  if (profileApolloErrorOnlyRecoverable(err)) return false;
  const e = err as {
    graphQLErrors?: readonly { message?: string }[];
    networkError?: { statusCode?: number; status?: number };
  };
  const msgs = (e.graphQLErrors ?? []).map((x) => x.message ?? "");
  const ne = e.networkError;
  const status = ne?.statusCode ?? ne?.status;
  if (msgs.length > 0) return shouldInvalidateStamplySession(msgs, status);
  return status === 401;
}
