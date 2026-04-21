import { gql } from "@apollo/client";

export const CUSTOMER_DETAIL_QUERY = gql`
  query CustomerDetail($customerId: Int!) {
    customerDetail(customerId: $customerId) {
      id
      name
      phone
      total_visits
      stamp_count
      visits {
        id
        customerId
        visitTime
      }
      rewards {
        id
        status
        issuedAt
        redeemedAt
      }
    }
  }
`;
