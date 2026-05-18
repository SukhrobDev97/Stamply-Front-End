export type TrialWarningKind = "today" | "tomorrow";

function localDayStartMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** ACTIVE business with trial ending on local calendar today or tomorrow. */
export function getTrialWarningState(opts: {
  trialEndsAt?: string | Date | null;
  businessStatus?: string | null;
}): TrialWarningKind | null {
  const status = String(opts.businessStatus ?? "active").toLowerCase();
  if (status === "deactivated" || status === "blocked") return null;
  if (status !== "active") return null;
  if (!opts.trialEndsAt) return null;

  const end = new Date(opts.trialEndsAt);
  if (Number.isNaN(end.getTime())) return null;

  const todayStart = localDayStartMs(new Date());
  const endStart = localDayStartMs(end);
  const tomorrowStart = todayStart + 86_400_000;

  if (endStart < todayStart) return null;
  if (endStart === todayStart) return "today";
  if (endStart === tomorrowStart) return "tomorrow";
  return null;
}
