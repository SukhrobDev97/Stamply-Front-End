import { gql } from "@apollo/client";

export const PROFILE_QUERY = gql`
  query Profile {
    profile {
      id
      telegram_id
      role
      name
      avatar_url
      business {
        id
        name
        phone
        address
      }
    }
  }
`;

