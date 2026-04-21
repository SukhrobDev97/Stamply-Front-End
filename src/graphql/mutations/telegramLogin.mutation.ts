import { gql } from "@apollo/client";

export const TELEGRAM_LOGIN_MUTATION = gql`
  mutation TelegramLogin($initData: String!) {
    telegramLogin(initData: $initData) {
      accessToken
    }
  }
`;

