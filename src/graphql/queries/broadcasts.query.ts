import { gql } from "@apollo/client";

/** Backend field name: `broadcasts` (adjust if e.g. `myBroadcasts`). */
export const BROADCASTS_QUERY = gql`
  query Broadcasts {
    broadcasts {
      id
      type
      message
      createdAt
      status
      sentCount
    }
  }
`;
