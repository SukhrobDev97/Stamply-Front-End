"use client";

type TrialInactiveCopy = {
  homeTrialInactiveTitle: string;
  homeTrialInactiveCard1Title: string;
  homeTrialInactiveCard1Body: string;
  homeTrialInactiveCard2Title: string;
  homeTrialInactiveCard2Body: string;
  homeTrialInactiveCard3Title: string;
  homeTrialInactiveCard3Body: string;
  homeTrialInactiveCta: string;
};

export function BusinessTrialInactiveScreen({
  txt,
  onCta,
}: {
  txt: TrialInactiveCopy;
  onCta: () => void;
}) {
  const rows: { title: string; body: string; emoji: string }[] = [
    { emoji: "⏰", title: txt.homeTrialInactiveCard1Title, body: txt.homeTrialInactiveCard1Body },
    { emoji: "⏸️", title: txt.homeTrialInactiveCard2Title, body: txt.homeTrialInactiveCard2Body },
    { emoji: "💬", title: txt.homeTrialInactiveCard3Title, body: txt.homeTrialInactiveCard3Body },
  ];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 pt-14 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px)+16px)] min-h-[calc(100svh-3.75rem-5.75rem)] sm:pt-16">
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
        <h1 className="text-center text-lg font-bold leading-snug text-slate-900">{txt.homeTrialInactiveTitle}</h1>

        <div className="mt-6 space-y-3">
          {rows.map((row) => (
            <div
              key={row.title}
              className="flex gap-3 rounded-2xl border border-slate-100 bg-[#F8FAFC] px-4 py-3.5"
            >
              <span className="text-xl leading-none" aria-hidden>
                {row.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-wide text-[#0284C7]">{row.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{row.body}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onCta}
          className="mt-7 w-full rounded-2xl bg-[#0284C7] py-3.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] hover:bg-[#0369a1]"
        >
          {txt.homeTrialInactiveCta}
        </button>
      </div>
    </div>
  );
}
