"use client";

import { useQuery } from "@apollo/client/react";
import { OWNER_DASHBOARD } from "@/graphql/queries/owner-dashboard";
import { useAuth } from "@/app/providers";

type OwnerDashboardStatsData = {
  visitsToday: number;
  totalCustomers: number;
  rewardsIssued?: number;
  pendingCount: number;
};

type OwnerDashboardQueryData = {
  ownerDashboardStats: OwnerDashboardStatsData;
};

export default function OwnerPage() {
  const { role } = useAuth();

  const canAccess = role === "owner";
  const { data, loading, error } = useQuery<OwnerDashboardQueryData>(OWNER_DASHBOARD, {
    skip: !canAccess,
  });

  if (!canAccess) {
    return (
      <div>
        <h1>Owner Dashboard</h1>
        <div>Owner only.</div>
      </div>
    );
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error.message}</p>;

  const stats = data?.ownerDashboardStats;

  return (
    <div>
      <h1>Owner Dashboard</h1>

      <h2>Metrics</h2>
      <div>Visits Today: {stats?.visitsToday ?? "-"}</div>
      <div>Total Customers: {stats?.totalCustomers ?? "-"}</div>
      <div>Rewards Issued: {stats?.rewardsIssued != null ? stats.rewardsIssued : "-"}</div>
      <div>Pending Requests: {stats?.pendingCount ?? "-"}</div>
    </div>
  );
}

