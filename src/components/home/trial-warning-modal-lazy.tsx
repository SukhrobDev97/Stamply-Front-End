"use client";

import dynamic from "next/dynamic";

export const TrialWarningModalLazy = dynamic(
  () => import("@/components/trial/TrialWarningModal").then((m) => m.TrialWarningModal),
  { ssr: false },
);
