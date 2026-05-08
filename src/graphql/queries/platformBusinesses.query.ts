import { gql } from "@apollo/client";

export const PLATFORM_BUSINESSES_QUERY = gql`
  query PlatformBusinesses($input: PlatformBusinessesInput) {
    platformBusinesses(input: $input) {
      total
      page
      limit
      items {
        id
        name
        businessType
        createdAt
        status
        trialEndsAt
        ownerName
        totalCustomers
        visitsToday
      }
    }
  }
`;

