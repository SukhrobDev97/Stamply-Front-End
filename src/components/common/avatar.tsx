"use client";

import { useMemo, useState } from "react";

function firstLetter(value: string) {
  const safe = (value ?? "").trim();
  return safe ? safe[0]!.toUpperCase() : "U";
}

export function Avatar({
  src,
  alt = "",
  fallbackText,
  size = 40,
  className = "",
  imgClassName = "",
}: {
  src?: string | null;
  alt?: string;
  fallbackText: string;
  size?: number;
  className?: string;
  imgClassName?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fallbackLetter = useMemo(() => firstLetter(fallbackText), [fallbackText]);
  const canShowImg = Boolean(src && !hasError);

  return (
    <div
      className={[
        "relative rounded-full overflow-hidden flex items-center justify-center",
        "bg-[#E6F4FA] text-[#0284C7] font-semibold",
        className,
      ].join(" ")}
      style={{ width: size, height: size }}
      aria-hidden={alt ? undefined : true}
    >
      {canShowImg ? (
        <>
          {!loaded ? (
            <div className="absolute inset-0 bg-gray-100 animate-pulse motion-reduce:animate-none" />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src as string}
            alt={alt}
            className={["h-full w-full object-cover", imgClassName].join(" ")}
            onLoad={() => setLoaded(true)}
            onError={() => setHasError(true)}
            referrerPolicy="no-referrer"
          />
        </>
      ) : (
        <span className="text-base">{fallbackLetter}</span>
      )}
    </div>
  );
}

