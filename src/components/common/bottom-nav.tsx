"use client";

import type React from "react";
import { usePathname, useRouter } from "next/navigation";
import { t, type ProfileLang } from "@/app/profile/copy";
import { useAppLang } from "@/lib/use-app-lang";

type BottomNavItem = {
  key: string;
  href?: string;
  icon: (props: { className: string }) => React.ReactNode;
};

function labelForNav(key: string, langTxt: (typeof t)[ProfileLang]) {
  switch (key) {
    case "home":
      return langTxt.navHome;
    case "users":
      return langTxt.homeCustomers;
    case "visits":
      return langTxt.visitsTitle;
    case "rewards":
      return langTxt.homeRewards;
    case "profile":
      return langTxt.profileTitle;
    default:
      return key;
  }
}

function IconHome({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconUsers({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M16.5 19.5c0-2.2-2-4-4.5-4s-4.5 1.8-4.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconVisits({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 12.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11A2 2 0 0 1 19.5 6.5v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconRewards({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4 10.5h16V12H4v-1.5Z"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M12 10.5c2.2 0 4-1.3 4-3 0-1.1-.7-2-1.8-2-.9 0-1.7.6-2.2 1.4-.5-.8-1.3-1.4-2.2-1.4-1.1 0-1.8.9-1.8 2 0 1.7 1.8 3 4 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconProfile({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 20c1.5-3 4-4.5 7-4.5S17.5 17 19 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const items: BottomNavItem[] = [
  { key: "home", href: "/", icon: (p) => <IconHome {...p} /> },
  {
    key: "users",
    href: "/customers",
    icon: (p) => <IconUsers {...p} />,
  },
  { key: "visits", href: "/visits", icon: (p) => <IconVisits {...p} /> },
  { key: "rewards", href: "/rewards", icon: (p) => <IconRewards {...p} /> },
  { key: "profile", href: "/profile", icon: (p) => <IconProfile {...p} /> },
];

export function BottomNav({ currentKey }: { currentKey: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { txt } = useAppLang();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[88px] border-t border-gray-200 bg-white">
      <div className="mx-auto flex h-full max-w-md items-stretch justify-between px-3 pb-1 pt-2">
        {items.map((it) => {
          const active =
            it.href && (pathname === it.href || pathname.startsWith(`${it.href}/`))
              ? true
              : it.key === currentKey;

          const content = (
            <div className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 px-1">
              <div
                className={[
                  "h-7 w-7",
                  active ? "text-[#00AEEF]" : "text-gray-400",
                ].join(" ")}
              >
                {it.icon({ className: "h-7 w-7" })}
              </div>
              <div
                className={[
                  "text-xs font-medium leading-none",
                  active ? "text-[#00AEEF]" : "text-gray-400",
                ].join(" ")}
              >
                {labelForNav(it.key, txt)}
              </div>
            </div>
          );

          if (!it.href) {
            return (
              <button
                key={it.key}
                type="button"
                className="flex flex-1 items-center justify-center opacity-60"
                aria-disabled="true"
              >
                {content}
              </button>
            );
          }

          return (
            <button
              key={it.key}
              type="button"
              className="flex flex-1 items-center justify-center active:scale-[0.98]"
              onClick={() => router.push(it.href!)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

