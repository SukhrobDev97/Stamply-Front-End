"use client";

import type { TrialWarningKind } from "@/lib/trial/get-trial-warning-state";

type TrialWarningModalProps = {
  show: boolean;
  kind: TrialWarningKind;
  message: string;
  payLabel: string;
  continueLabel: string;
  overlayClassName: string;
  panelClassName: string;
  panelOpenClassName: string;
  onOverlayTransitionEnd: (e: React.TransitionEvent<HTMLDivElement>) => void;
  onPay: () => void;
  onContinue: () => void;
};

export function TrialWarningModal({
  show,
  message,
  payLabel,
  continueLabel,
  overlayClassName,
  panelClassName,
  panelOpenClassName,
  onOverlayTransitionEnd,
  onPay,
  onContinue,
}: TrialWarningModalProps) {
  if (!show) return null;

  return (
    <div
      className={overlayClassName}
      onTransitionEnd={onOverlayTransitionEnd}
      role="presentation"
    >
      <div
        className={[
          "w-full max-w-sm rounded-2xl border border-black/5 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]",
          panelClassName,
          panelOpenClassName,
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-warning-message"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="trial-warning-message" className="text-sm font-medium leading-relaxed text-[#0F172A]">
          {message}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onPay}
            className="w-full rounded-xl bg-[#0284C7] py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
          >
            {payLabel}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 active:scale-[0.99]"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
