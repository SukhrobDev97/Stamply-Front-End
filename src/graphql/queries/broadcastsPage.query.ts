import { gql } from "@apollo/client";

export const BROADCASTS_PAGE_QUERY = gql`
  query BroadcastsPage($limit: Int, $cursor: String) {
    broadcastsPage(limit: $limit, cursor: $cursor) {
      items {
        id
        type
        message
        createdAt
        status
        sentCount
      }
      pageInfo {
        nextCursor
        hasMore
      }
    }
  }
`;
