"use client";

type LoadMoreButtonProps = {
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreLabel: string;
  loadingMoreLabel: string;
  onLoadMore: () => void;
};

export function LoadMoreButton({
  hasMore,
  loadingMore,
  loadMoreLabel,
  loadingMoreLabel,
  onLoadMore,
}: LoadMoreButtonProps) {
  if (!hasMore) return null;
  return (
    <button
      type="button"
      disabled={loadingMore}
      onClick={() => void onLoadMore()}
      className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-[#0284C7] disabled:opacity-50 active:scale-[0.99]"
    >
      {loadingMore ? loadingMoreLabel : loadMoreLabel}
    </button>
  );
}
