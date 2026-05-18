"use client";

import { CUSTOMERS_PAGE_QUERY } from "@/graphql/queries/customersPage.query";
import { OWNER_DASHBOARD } from "@/graphql/queries/owner-dashboard";
import { useAuth } from "@/app/providers";
import { useQuery } from "@apollo/client/react";
import { useCursorPage } from "@/hooks/use-cursor-page";

export type CustomerListItem = {
  id: number;
  name: string;
  phone: string;
  totalVisits: number;
  stampCount: number;
};

type OwnerDashboardCache = {
  ownerDashboardStats?: { totalCustomers?: number };
};

export function useCustomersPage() {
  const { ready, isAuthenticated } = useAuth();
  const skip = !ready || !isAuthenticated;

  const page = useCursorPage<CustomerListItem>({
    query: CUSTOMERS_PAGE_QUERY,
    fieldName: "customersPage",
    skip,
  });

  const { data: dashCache } = useQuery<OwnerDashboardCache>(OWNER_DASHBOARD, {
    skip,
    fetchPolicy: "cache-only",
  });

  const totalCustomers = dashCache?.ownerDashboardStats?.totalCustomers;
  const loadedCount = page.items.length;

  const totalLabel =
    typeof totalCustomers === "number" && totalCustomers >= loadedCount
      ? page.hasMore
        ? `${loadedCount}+ / ${totalCustomers}`
        : String(totalCustomers)
      : page.hasMore
        ? `${loadedCount}+`
        : String(loadedCount);

  return { ...page, totalLabel, loadedCount };
}
