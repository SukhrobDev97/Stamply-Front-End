import { gql } from "@apollo/client";

/**
 * input CreateBroadcastInput {
 *   type: BroadcastType!
 *   message: String!
 *   images: [String!]   # optional public HTTPS image URLs (not base64)
 * }
 */
export const CREATE_BROADCAST_MUTATION = gql`
  mutation CreateBroadcast($input: CreateBroadcastInput!) {
    createBroadcast(input: $input) {
      id
      status
    }
  }
`;
