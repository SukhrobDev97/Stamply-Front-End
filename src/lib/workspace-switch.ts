import { OWNER_DASHBOARD } from "@/graphql/queries/owner-dashboard";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";
import type { DocumentNode } from "graphql";

type SelectWorkspaceFn = (options: { variables: { businessId: number } }) => Promise<unknown>;
type ClientLike = {
  query: (options: { query: DocumentNode; fetchPolicy?: "network-only" }) => Promise<unknown>;
};
type RouterLike = {
  replace: (href: string) => void;
  push?: (href: string) => void;
};

type SwitchBusinessWorkspaceOptions = {
  businessId: number;
  selectWorkspace: SelectWorkspaceFn;
  switchToBusiness: (businessId: number) => void;
  router: RouterLike;
  client?: ClientLike;
  refetchWorkspaces?: () => Promise<unknown>;
  routeTo?: string;
  refreshDashboard?: boolean;
  refreshProfile?: boolean;
};

export async function switchToBusinessWorkspace({
  businessId,
  selectWorkspace,
  switchToBusiness,
  router,
  client,
  refetchWorkspaces,
  routeTo = "/",
  refreshDashboard = false,
  refreshProfile = true,
}: SwitchBusinessWorkspaceOptions): Promise<void> {
  await selectWorkspace({ variables: { businessId } });
  switchToBusiness(businessId);

  const refreshes: Promise<unknown>[] = [];
  if (refetchWorkspaces) refreshes.push(refetchWorkspaces().catch(() => null));
  if (client && refreshProfile) {
    refreshes.push(client.query({ query: PROFILE_QUERY, fetchPolicy: "network-only" }).catch(() => null));
  }
  if (client && refreshDashboard) {
    refreshes.push(client.query({ query: OWNER_DASHBOARD, fetchPolicy: "network-only" }).catch(() => null));
  }

  if (refreshes.length > 0) await Promise.all(refreshes);
  router.replace(routeTo);
}

export function switchToPlatformWorkspace({
  switchToPlatform,
  router,
  routeTo = "/owner",
  replace = true,
}: {
  switchToPlatform: () => void;
  router: RouterLike;
  routeTo?: string;
  replace?: boolean;
}): void {
  switchToPlatform();
  if (!replace && router.push) router.push(routeTo);
  else router.replace(routeTo);
}
