"use client";

import { motion, useReducedMotion } from "framer-motion";

function StampGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M6 8.5h12a2 2 0 012 2v1.2a1.5 1.5 0 01-1.5 1.5H5.5A1.5 1.5 0 014 11.7V10.5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 14.5h9M8 17h5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type PremiumDashboardLoaderProps = {
  /** When true, opacity animates to 0 over 200ms before parent unmounts */
  fading: boolean;
  hint?: string;
};

export function PremiumDashboardLoader({ fading, hint }: PremiumDashboardLoaderProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={[
        "fixed inset-0 z-[200] flex items-center justify-center bg-white/80 backdrop-blur-[6px]",
        "transition-[opacity] duration-200 ease-in-out motion-reduce:transition-none",
        fading ? "opacity-0" : "opacity-100",
      ].join(" ")}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center justify-center gap-3 px-6">
        <motion.div
          className="text-[#0284C7]"
          animate={
            reduceMotion
              ? {}
              : {
                  rotate: [0, 7, -5, 0],
                  y: [0, -3, 0],
                  scale: [1, 1.06, 1],
                }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  duration: 2.4,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }
          }
        >
          <StampGlyph className="h-12 w-12 shrink-0" />
        </motion.div>
        {hint ? (
          <p className="max-w-[240px] text-center text-xs font-medium tracking-wide text-gray-400">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
