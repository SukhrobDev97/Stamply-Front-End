type QuickActionCardProps = {
  title: string;
};

export function QuickActionCard({ title }: QuickActionCardProps) {
  return (
    <button
      type="button"
      className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-left text-sm font-medium text-zinc-100 active:scale-[0.99]"
    >
      <span>{title}</span>
      <span className="text-zinc-500">→</span>
    </button>
  );
}

