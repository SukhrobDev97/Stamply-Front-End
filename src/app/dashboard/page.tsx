"use client";

import { useQuery } from "@apollo/client/react";
import { DASHBOARD_STATS_QUERY } from "@/graphql/queries/dashboard.query";
import { userMessageFromUnknown } from "@/lib/api";
import { useAppLang } from "@/lib/use-app-lang";

type DashboardStatsData = {
  todayVisits?: number;
  yesterdayVisits?: number;
  percentChange?: number | null;
  trendDirection?: string | null;
  totalCustomers?: number;
};

export default function DashboardPage() {
  const { lang } = useAppLang();
  const { data, loading, error } = useQuery<{ getDashboardStats: DashboardStatsData }>(DASHBOARD_STATS_QUERY);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{userMessageFromUnknown(error, lang)}</p>;

  const stats = data?.getDashboardStats;

  return (
    <div className="p-4">
      <div>Today visits: {stats?.todayVisits ?? "-"}</div>
      <div>Yesterday visits: {stats?.yesterdayVisits ?? "-"}</div>
      <div>Change %: {stats?.percentChange ?? "-"}</div>
      <div>Trend: {stats?.trendDirection ?? "-"}</div>
      <div>Total customers: {stats?.totalCustomers ?? "-"}</div>
    </div>
  );
}
