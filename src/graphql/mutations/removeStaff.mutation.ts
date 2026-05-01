import { gql } from "@apollo/client";

export const REMOVE_STAFF_MUTATION = gql`
  mutation RemoveStaff($staffId: Int!) {
    removeStaff(staffId: $staffId)
  }
`;
