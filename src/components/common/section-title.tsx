import type { ReactNode } from "react";

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-xs font-semibold tracking-wide text-gray-500">
      {children}
    </div>
  );
}

