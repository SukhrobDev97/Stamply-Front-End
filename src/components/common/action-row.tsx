import type { ReactNode } from "react";

type ActionRowProps = {
  title: string;
  icon: ReactNode;
  onClick?: () => void;
};

export function ActionRow({ title, icon, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-zinc-950/60 px-4 py-3 text-left text-sm font-medium text-zinc-100 border border-zinc-900/60 active:scale-[0.99]"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-900/60 text-zinc-200">
        {icon}
      </span>
      <span className="flex-1">{title}</span>
      <span className="text-zinc-500">→</span>
    </button>
  );
}

