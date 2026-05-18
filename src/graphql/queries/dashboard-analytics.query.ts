import { gql } from "@apollo/client";

export const DASHBOARD_ANALYTICS_QUERY = gql`
  query DashboardAnalytics($range: DashboardAnalyticsRange!) {
    dashboardAnalytics(range: $range) {
      todayVisits
      weeklyVisits
      monthlyVisits
      avgVisitsPerDay
      growthPercent
      chartPoints {
        label
        value
        bucketStart
      }
    }
  }
`;
