"use client";

import { useMutation } from "@apollo/client/react";
import { CREATE_BUSINESS } from "@/graphql/mutations/createBusiness";
import { useState } from "react";

export function CreateBusinessOnboarding() {
  const [name, setName] = useState("");
  const [createBusiness, { loading }] = useMutation(CREATE_BUSINESS);

  const onSubmit = async () => {
    try {
      const trimmed = name.trim();
      if (!trimmed) return;

      await createBusiness({
        variables: { input: { name: trimmed } },
      });
    } catch (e) {
      alert("Failed to create business");
    }
  };

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6">
          <div className="text-xl font-semibold">Create your business</div>
          <div className="mt-2 text-sm text-zinc-400">
            Set up your workspace to start tracking visits and rewards.
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Business name"
            className="mt-6 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600"
          />

          <button
            onClick={onSubmit}
            disabled={loading || !name.trim()}
            className="mt-4 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Business"}
          </button>
        </div>
      </div>
    </div>
  );
}

