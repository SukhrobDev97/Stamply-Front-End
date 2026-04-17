export type AppEnv = {
  readonly graphqlUrl: string;
};

function readEnv(): AppEnv {
  const raw = process.env.NEXT_PUBLIC_GRAPHQL_URL;

  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(
      "Missing NEXT_PUBLIC_GRAPHQL_URL. Add it to .env.local (e.g. NEXT_PUBLIC_GRAPHQL_URL=https://api.example.com/graphql).",
    );
  }

  return { graphqlUrl: raw.trim() } as const;
}

export const env: AppEnv = readEnv();
