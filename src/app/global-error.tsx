"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-[#f7f7f8] p-4 text-black">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center">
          <div className="w-full rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold">Stamply</h1>
            <p className="mt-2 text-sm text-gray-600">Something went wrong. Please try again.</p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-5 w-full rounded-2xl bg-[#0284C7] py-3 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
