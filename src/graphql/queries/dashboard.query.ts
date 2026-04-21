import { gql } from "@apollo/client";

export const DASHBOARD_STATS_QUERY = gql`
  query DashboardStats {
    dashboardStats {
      visitsToday
      totalCustomers
      rewardsIssued
    }
  }
`;

