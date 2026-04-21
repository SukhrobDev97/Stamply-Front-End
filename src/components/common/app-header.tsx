type AppHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: string;
};

export function AppHeader({ title, subtitle, badge }: AppHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-lg font-semibold text-zinc-100 truncate">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-1 text-xs text-zinc-400">{subtitle}</div>
        ) : null}
      </div>

      {badge ? (
        <div className="shrink-0 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
          {badge}
        </div>
      ) : null}
    </div>
  );
}

