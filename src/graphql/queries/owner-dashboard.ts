import { gql } from "@apollo/client";

export const OWNER_DASHBOARD = gql`
  query OwnerDashboardStats {
    ownerDashboardStats {
      visitsToday
      todayVisits
      yesterdayVisits
      percentChange
      trendDirection
      totalCustomers
      pendingCount
      recentActivity {
        id
        type
        title
        customer_name
        createdAt
      }
      pendingVisits {
        id
        customerId
        customerName
        visitTime
      }
    }
  }
`;

