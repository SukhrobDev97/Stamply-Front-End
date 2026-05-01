import { gql } from "@apollo/client";

export const GET_BUSINESS_STAFF_QUERY = gql`
  query GetBusinessStaff {
    getBusinessStaff {
      id
      name
      telegram_id
      avatar_url
    }
  }
`;
