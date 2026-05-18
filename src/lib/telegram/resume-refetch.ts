import type { ApolloClient } from "@apollo/client";
import { OWNER_DASHBOARD } from "@/graphql/queries/owner-dashboard";
import { MY_WORKSPACES_QUERY } from "@/graphql/queries/myWorkspaces.query";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";

/** Targeted refresh when Mini App returns from background (avoids global observable storm). */
export async function resumeStamplyQueries(client: ApolloClient) {
  const tasks: Promise<unknown>[] = [
    client.query({ query: OWNER_DASHBOARD, fetchPolicy: "network-only" }).catch(() => null),
    client.query({ query: MY_WORKSPACES_QUERY, fetchPolicy: "network-only" }).catch(() => null),
  ];

  try {
    const cached = client.readQuery({ query: PROFILE_QUERY });
    if (!cached) {
      tasks.push(
        client.query({ query: PROFILE_QUERY, fetchPolicy: "cache-first" }).catch(() => null),
      );
    }
  } catch {
    tasks.push(
      client.query({ query: PROFILE_QUERY, fetchPolicy: "cache-first" }).catch(() => null),
    );
  }

  await Promise.all(tasks);
}
