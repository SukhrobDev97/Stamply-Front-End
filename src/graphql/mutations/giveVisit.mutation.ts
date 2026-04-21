import { gql } from "@apollo/client";

export const GIVE_VISIT_MUTATION = gql`
  mutation GiveVisit($customerId: Int!) {
    giveVisit(customerId: $customerId) {
      success
      rewardUnlocked
      rewardId
    }
  }
`;

