import { InMemoryCache } from "@apollo/client";
import type { FieldPolicy } from "@apollo/client/cache";

type PageShape<T> = {
  items?: T[];
  pageInfo?: { nextCursor?: string | null; hasMore?: boolean };
};

function mergeCursorPage<T extends { id?: number | string }>(
  existing: PageShape<T> | undefined,
  incoming: PageShape<T>,
  args: { cursor?: string | null } | null,
): PageShape<T> {
  if (!args?.cursor) {
    return incoming;
  }
  const prev = existing?.items ?? [];
  const next = incoming?.items ?? [];
  const seen = new Set(prev.map((x) => x.id));
  const merged = [...prev];
  for (const item of next) {
    if (item.id != null && seen.has(item.id)) continue;
    if (item.id != null) seen.add(item.id);
    merged.push(item);
  }
  return {
    items: merged,
    pageInfo: incoming.pageInfo,
  };
}

const customersPagePolicy: FieldPolicy = {
  keyArgs: ["limit"],
  merge(existing, incoming, { args }) {
    return mergeCursorPage(existing, incoming, args as { cursor?: string | null });
  },
};

const rewardsPagePolicy: FieldPolicy = {
  keyArgs: ["limit", "status"],
  merge(existing, incoming, { args }) {
    return mergeCursorPage(existing, incoming, args as { cursor?: string | null });
  },
};

const broadcastsPagePolicy: FieldPolicy = {
  keyArgs: ["limit"],
  merge(existing, incoming, { args }) {
    return mergeCursorPage(existing, incoming, args as { cursor?: string | null });
  },
};

export function createApolloCache() {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          customersPage: customersPagePolicy,
          rewardsPage: rewardsPagePolicy,
          broadcastsPage: broadcastsPagePolicy,
        },
      },
    },
  });
}
