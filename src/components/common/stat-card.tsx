type StatCardProps = {
  label: string;
  value: string;
  trend?: string;
  size?: "default" | "large";
};

export function StatCard({ label, value, trend, size = "default" }: StatCardProps) {
  const isLarge = size === "large";

  return (
    <div
      className={[
        "rounded-2xl bg-zinc-950/60",
        isLarge ? "p-5" : "p-4",
        "border border-zinc-900/60",
      ].join(" ")}
    >
      <div className={isLarge ? "text-xs font-medium text-zinc-400" : "text-[11px] font-medium text-zinc-400"}>
        {label}
      </div>
      <div className={isLarge ? "mt-2 text-3xl font-semibold text-zinc-100" : "mt-2 text-xl font-semibold text-zinc-100"}>
        {value}
      </div>
      {trend ? (
        <div className="mt-1 text-[11px] text-zinc-500">{trend}</div>
      ) : null}
    </div>
  );
}

