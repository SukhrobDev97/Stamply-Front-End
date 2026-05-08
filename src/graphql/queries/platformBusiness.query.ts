import { gql } from "@apollo/client";

export const PLATFORM_BUSINESS_QUERY = gql`
  query PlatformBusiness($id: Int!) {
    platformBusiness(id: $id) {
      id
      name
      businessType
      status
      createdAt
      trialEndsAt
      activatedAt
      blockedAt
      ownerId
      ownerName
      ownerTelegramId
      totalCustomers
      rewardsCount
      broadcastsCount
      visitsToday
    }
  }
`;

