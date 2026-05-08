import { gql } from "@apollo/client";

export const OWNER_ME_QUERY = gql`
  query OwnerMe {
    ownerMe {
      id
      telegram_id
      role
    }
  }
`;
