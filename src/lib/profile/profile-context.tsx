"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ProfileBusiness = {
  id: number;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  businessType?: string | null;
  status?: string | null;
  trialEndsAt?: string | null;
};

export type ProfileData = {
  profile: {
    id?: number | string;
    role?: string | null;
    name?: string | null;
    avatar_url?: string | null;
    business?: ProfileBusiness | null;
  } | null;
};

export type ProfileContextValue = {
  profileData: ProfileData | undefined;
  loading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({
  value,
  children,
}: {
  value: ProfileContextValue;
  children: ReactNode;
}) {
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within RequireAuth (ProfileProvider)");
  }
  return ctx;
}

/** When route is not behind full profile gate (e.g. platform owner). */
export function useProfileOptional(): ProfileContextValue | null {
  return useContext(ProfileContext);
}
