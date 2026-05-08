import { gql } from "@apollo/client";

export const SELECT_WORKSPACE_MUTATION = gql`
  mutation SelectWorkspace($businessId: Int!) {
    selectWorkspace(businessId: $businessId)
  }
`;

