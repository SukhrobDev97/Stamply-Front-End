import { gql } from "@apollo/client";

export const PLATFORM_DASHBOARD_STATS_QUERY = gql`
  query PlatformDashboardStats {
    platformDashboardStats {
      totalBusinesses
      activeBusinesses
      trialBusinesses
      deactivatedBusinesses
    }
  }
`;
