import { gql } from "@apollo/client";

export const CREATE_BUSINESS = gql`
  mutation CreateBusiness($input: CreateBusinessOnboardingInput!) {
    createBusiness(input: $input) {
      id
      name
    }
  }
`;

