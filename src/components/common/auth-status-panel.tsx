"use client";

type AuthStatusPanelProps = {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function AuthStatusPanel({ title, body, actionLabel, onAction }: AuthStatusPanelProps) {
  return (
    <div className="min-h-dvh bg-[#f7f7f8] text-black">
      <div className="mx-auto max-w-md px-4 pt-10 pb-32">
        <div className="rounded-2xl border border-black/5 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
          {body ? <p className="mt-2 text-xs text-gray-500">{body}</p> : null}
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="mt-4 w-full rounded-xl bg-[#0284C7] py-2.5 text-sm font-semibold text-white"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
