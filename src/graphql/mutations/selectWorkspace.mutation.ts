import { gql } from "@apollo/client";

export const SELECT_WORKSPACE_MUTATION = gql`
  mutation SelectWorkspace($businessId: Int!) {
    selectWorkspace(businessId: $businessId) {
      active_business_id
      canCreateBusiness
      hasPlatformDashboard
      items {
        business_id
        name
        business_type
        role
        status
        is_active_workspace
      }
    }
  }
`;
