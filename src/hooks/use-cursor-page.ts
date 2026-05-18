"use client";

import type { DocumentNode } from "graphql";
import { useQuery } from "@apollo/client/react";
import { useCallback, useMemo } from "react";

export const CURSOR_PAGE_DEFAULT_LIMIT = 50;

export type PageInfo = {
  nextCursor?: string | null;
  hasMore: boolean;
};

export type CursorPageData<T> = Record<string, { items: T[]; pageInfo: PageInfo } | undefined>;

type UseCursorPageOptions = {
  query: DocumentNode;
  /** Root field name in the query result, e.g. "customersPage". */
  fieldName: string;
  skip?: boolean;
  limit?: number;
  extraVariables?: Record<string, unknown>;
};

export function useCursorPage<T>({
  query,
  fieldName,
  skip = false,
  limit = CURSOR_PAGE_DEFAULT_LIMIT,
  extraVariables = {},
}: UseCursorPageOptions) {
  const variables = useMemo(
    () => ({ limit, cursor: null as string | null, ...extraVariables }),
    [limit, extraVariables],
  );

  const { data, loading, error, fetchMore, refetch, networkStatus } = useQuery<CursorPageData<T>>(
    query,
    {
      variables,
      skip,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
    },
  );

  const page = data?.[fieldName];
  const items = page?.items ?? [];
  const hasMore = Boolean(page?.pageInfo?.hasMore);
  const nextCursor = page?.pageInfo?.nextCursor ?? null;

  const loadingMore = networkStatus === 3;

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    await fetchMore({
      variables: { limit, cursor: nextCursor, ...extraVariables },
    });
  }, [hasMore, nextCursor, loadingMore, fetchMore, limit, extraVariables]);

  const refetchFirstPage = useCallback(async () => {
    await refetch({ limit, cursor: null, ...extraVariables });
  }, [refetch, limit, extraVariables]);

  return {
    items,
    loading: loading && items.length === 0,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refetchFirstPage,
    refetch,
  };
}
