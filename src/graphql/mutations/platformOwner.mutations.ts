import { gql } from "@apollo/client";

export const ACTIVATE_BUSINESS_MUTATION = gql`
  mutation ActivateBusiness($input: BusinessIdInput!) {
    activateBusiness(input: $input)
  }
`;

export const DEACTIVATE_BUSINESS_MUTATION = gql`
  mutation DeactivateBusiness($input: BusinessIdInput!) {
    deactivateBusiness(input: $input)
  }
`;

export const DELETE_BUSINESS_MUTATION = gql`
  mutation DeleteBusiness($input: BusinessIdInput!) {
    deleteBusiness(input: $input)
  }
`;

export const EXTEND_TRIAL_MUTATION = gql`
  mutation ExtendTrial($input: ExtendTrialInput!) {
    extendTrial(input: $input)
  }
`;

