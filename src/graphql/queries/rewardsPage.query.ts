import { gql } from "@apollo/client";

export const REWARDS_PAGE_QUERY = gql`
  query RewardsPage($limit: Int, $cursor: String) {
    rewardsPage(limit: $limit, cursor: $cursor) {
      items {
        id
        status
        customerId
        customerName
        issuedAt
        redeemedAt
        expiresAt
      }
      pageInfo {
        nextCursor
        hasMore
      }
    }
  }
`;
