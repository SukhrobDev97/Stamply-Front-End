import { gql } from "@apollo/client";

export const REDEEM_REWARD_MUTATION = gql`
  mutation RedeemReward($rewardId: Int!) {
    redeemReward(rewardId: $rewardId)
  }
`;
