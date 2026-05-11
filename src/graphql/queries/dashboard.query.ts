import { gql } from "@apollo/client";

export const DASHBOARD_STATS_QUERY = gql`
  query DashboardStats {
    getDashboardStats {
      totalCustomers
      totalVisits
      availableRewards
      redeemedRewards
      todayVisits
      yesterdayVisits
      percentChange
      trendDirection
      weeklyVisits
      monthlyVisits
      conversionRate
    }
  }
`;
