import { gql } from "@apollo/client";

export const OWNER_DASHBOARD = gql`
  query OwnerDashboardStats {
    ownerDashboardStats {
      visitsToday
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
        visitTime
      }
    }
  }
`;

