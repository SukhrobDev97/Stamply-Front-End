import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { env } from "@/lib/config/env";

function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({ uri: env.graphqlUrl }),
    cache: new InMemoryCache(),
  });
}

const globalForApollo = globalThis as typeof globalThis & {
  __stamplyApolloClient?: ApolloClient;
};

export const apolloClient =
  globalForApollo.__stamplyApolloClient ?? createApolloClient();

if (process.env.NODE_ENV !== "production") {
  globalForApollo.__stamplyApolloClient = apolloClient;
}
