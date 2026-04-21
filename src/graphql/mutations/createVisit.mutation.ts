import { gql } from "@apollo/client";

export const CREATE_VISIT_MUTATION = gql`
  mutation CreateVisit($input: CreateVisitInput!) {
    createVisit(input: $input) {
      id
      customerId
      visitTime
    }
  }
`;

