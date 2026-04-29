import { gql } from "@apollo/client";

export const CREATE_STAFF_INVITE_MUTATION = gql`
  mutation CreateStaffInvite {
    createStaffInvite {
      inviteUrl
    }
  }
`;

