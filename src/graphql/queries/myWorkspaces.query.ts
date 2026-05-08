import { gql } from "@apollo/client";

export const MY_WORKSPACES_QUERY = gql`
  query MyWorkspaces {
    myWorkspaces {
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

