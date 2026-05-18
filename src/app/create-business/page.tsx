"use client";

import { useAuth } from "@/app/providers";
import { useAppMode } from "@/lib/app-mode";
import { CREATE_BUSINESS } from "@/graphql/mutations/createBusiness";
import { SELECT_WORKSPACE_MUTATION } from "@/graphql/mutations/selectWorkspace.mutation";
import { MY_WORKSPACES_QUERY } from "@/graphql/queries/myWorkspaces.query";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";
import { useAppLang } from "@/lib/use-app-lang";
import { apolloClient } from "@/lib/apollo/client";
import { useMutation } from "@apollo/client/react";

type CreateBusinessMutationData = {
  createBusiness?: { id?: number | null } | null;
};
import { ArrowLeft, Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateBusinessPage() {
  const router = useRouter();
  const { ready, isAuthenticated, role } = useAuth();
  const { switchToBusiness } = useAppMode();
  const isPlatformOwner = role === "platform_owner";
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const { txt } = useAppLang();

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated || !token) router.replace("/");
  }, [isAuthenticated, ready, router, token]);

  const [bizName, setBizName] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizType, setBizType] = useState("");
  const [bizTypeTouched, setBizTypeTouched] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [createBusiness, { loading }] = useMutation(CREATE_BUSINESS);
  const [selectWorkspace] = useMutation(SELECT_WORKSPACE_MUTATION);
  const normalizedBizType = bizType.trim();
  const isBizTypeInvalid = normalizedBizType.length === 0;

  if (!ready) return null;
  if (!isAuthenticated || !token) return null;

  return (
    <div className="min-h-dvh bg-[#F5F7FB] text-black">
      <div className="mx-auto max-w-md px-4 pb-24 pt-6">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm active:scale-[0.99]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] bg-slate-100 text-slate-700">
            <Building2 className="h-6 w-6" aria-hidden />
          </div>
          <div className="mt-4 text-center text-lg font-semibold text-slate-900">{txt.registerTitle}</div>
          <div className="mt-1 text-center text-sm text-slate-500">{txt.registerSubtitle}</div>

          <div className="mt-4 space-y-2">
            <input
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              placeholder={txt.registerBizNamePh}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            <input
              value={bizPhone}
              onChange={(e) => setBizPhone(e.target.value)}
              placeholder={txt.registerPhonePh}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            <input
              value={bizAddress}
              onChange={(e) => setBizAddress(e.target.value)}
              placeholder={txt.registerAddressPh}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            <input
              value={bizType}
              onChange={(e) => setBizType(e.target.value)}
              onBlur={() => setBizTypeTouched(true)}
              placeholder={txt.registerTypePh}
              className={[
                "w-full rounded-2xl border bg-white px-4 py-3 text-base text-black placeholder:text-slate-400 focus:outline-none focus:ring-2",
                bizTypeTouched && isBizTypeInvalid
                  ? "border-red-300 focus:ring-red-100"
                  : "border-slate-200 focus:ring-slate-200",
              ].join(" ")}
            />
            {bizTypeTouched && isBizTypeInvalid ? (
              <div className="text-xs font-medium text-red-600">Business type is required.</div>
            ) : null}
          </div>

          {msg ? <div className="mt-3 text-sm text-slate-600">{msg}</div> : null}

          <button
            type="button"
            disabled={loading || !bizName.trim() || !bizPhone.trim() || isBizTypeInvalid}
            onClick={() => {
              setMsg(null);
              setBizTypeTouched(true);
              if (isBizTypeInvalid) {
                setMsg("Please enter a valid business type.");
                return;
              }
              void (async () => {
                try {
                  const res = await createBusiness({
                    variables: {
                      input: {
                        name: bizName.trim(),
                        phone: bizPhone.trim(),
                        address: bizAddress.trim() || null,
                        businessType: normalizedBizType.toUpperCase().replace(/\s+/g, "_"),
                      },
                    },
                  });
                  const newBusinessId: number | null =
                    (res.data as CreateBusinessMutationData | undefined)?.createBusiness?.id ?? null;
                  if (isPlatformOwner) {
                    if (newBusinessId) {
                      try { await selectWorkspace({ variables: { businessId: newBusinessId } }); } catch { /* ignore */ }
                      switchToBusiness(newBusinessId);
                    }
                    try { await apolloClient.query({ query: MY_WORKSPACES_QUERY, fetchPolicy: "network-only" }); } catch { /* ignore */ }
                    router.replace("/");
                  } else {
                    if (newBusinessId) {
                      try {
                        await selectWorkspace({ variables: { businessId: newBusinessId } });
                      } catch {
                        /* ignore */
                      }
                    }
                    try {
                      await Promise.all([
                        apolloClient.query({ query: PROFILE_QUERY, fetchPolicy: "network-only" }),
                        apolloClient.query({ query: MY_WORKSPACES_QUERY, fetchPolicy: "network-only" }),
                      ]);
                    } catch {
                      /* ignore refresh errors */
                    }
                    router.replace("/");
                  }
                } catch {
                  setMsg(txt.registerFailed);
                }
              })();
            }}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#0284C7] py-3 text-sm font-semibold text-white transition disabled:opacity-50 active:scale-[0.99]"
          >
            {loading ? txt.registerCreating : txt.registerCreateBusiness}
          </button>
        </div>
      </div>
    </div>
  );
}

