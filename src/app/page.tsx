"use client";

import { useQuery } from "@apollo/client/react";
import { TEST_QUERY } from "@/graphql/queries/test.query";

export default function Home() {
  const { data, loading, error } = useQuery(TEST_QUERY);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error.message}</p>;

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
