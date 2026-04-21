"use client";

import { useQuery } from "@apollo/client/react";
import { DASHBOARD_STATS_QUERY } from "@/graphql/queries/dashboard.query";

export default function DashboardPage() {
  const { data, loading, error } = useQuery(DASHBOARD_STATS_QUERY);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error.message}</p>;

  const stats = (data as any)?.dashboardStats;

  return (
    <div>
      <div>Visits Today: {stats?.visitsToday ?? "-"}</div>
      <div>Total Customers: {stats?.totalCustomers ?? "-"}</div>
      <div>Rewards Issued: {stats?.rewardsIssued ?? "-"}</div>
    </div>
  );
}

