import { gql } from "@apollo/client";

export const CUSTOMERS_PAGE_QUERY = gql`
  query CustomersPage($limit: Int, $cursor: String) {
    customersPage(limit: $limit, cursor: $cursor) {
      items {
        id
        name
        phone
        totalVisits
        stampCount
      }
      pageInfo {
        nextCursor
        hasMore
      }
    }
  }
`;
