export type EnvValidationIssue = {
  key: string;
  message: string;
};

/** Client-safe env checks (logs in dev only). */
export function validateClientEnv(): EnvValidationIssue[] {
  const issues: EnvValidationIssue[] = [];
  const gql = process.env.NEXT_PUBLIC_GRAPHQL_URL?.trim();
  if (!gql) {
    issues.push({
      key: "NEXT_PUBLIC_GRAPHQL_URL",
      message: "Missing GraphQL URL",
    });
  }
  return issues;
}

export function logEnvIssuesDev(): void {
  if (process.env.NODE_ENV !== "development") return;
  const issues = validateClientEnv();
  for (const i of issues) {
    console.warn(`[stamply-env] ${i.key}: ${i.message}`);
  }
}
