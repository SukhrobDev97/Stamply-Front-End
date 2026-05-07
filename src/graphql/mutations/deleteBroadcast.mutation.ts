import { gql } from "@apollo/client";

export const DELETE_BROADCAST_MUTATION = gql`
  mutation DeleteBroadcast($id: Int!) {
    deleteBroadcast(id: $id)
  }
`;
