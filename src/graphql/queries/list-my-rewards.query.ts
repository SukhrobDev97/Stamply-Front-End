import { gql } from "@apollo/client";

export const LIST_MY_REWARDS_QUERY = gql`
  query ListMyRewards {
    listMyRewards {
      id
      status
      customerId
      customerName
      issuedAt
      redeemedAt
      expiresAt
    }
  }
`;
