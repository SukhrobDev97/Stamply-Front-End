import { gql } from "@apollo/client";

export const MY_CUSTOMERS_QUERY = gql`
  query MyCustomers {
    myCustomers {
      id
      name
      phone
      totalVisits
      stampCount
    }
  }
`;

