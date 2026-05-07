import { gql } from "@apollo/client";

export const GET_BROADCAST_QUERY = gql`
  query GetBroadcast($id: Int!) {
    getBroadcast(id: $id) {
      id
      status
      sentCount
    }
  }
`;
