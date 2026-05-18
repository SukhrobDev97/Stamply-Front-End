"use client";

import { useMutation } from "@apollo/client/react";
import { CREATE_VISIT_MUTATION } from "@/graphql/mutations/createVisit.mutation";
import { OWNER_DASHBOARD } from "@/graphql/queries/owner-dashboard";
import { getTelegramWebApp } from "@/lib/telegram/webapp";
import { useAuth } from "@/app/providers";
import { userMessageFromUnknown } from "@/lib/api";
import { useCallback, useMemo, useState } from "react";

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function parseCustomerIdFromQrText(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("visit_")) return null;
  const id = Number(trimmed.slice("visit_".length));
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export default function StaffPage() {
  const { role } = useAuth();
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [lastScan, setLastScan] = useState<string | null>(null);

  const [createVisit, { loading: visitLoading }] = useMutation(
    CREATE_VISIT_MUTATION,
  );

  const canAccess = role === "staff";

  const statusText = useMemo(() => {
    if (!canAccess) return "Access denied: staff only";
    if (scanState.status === "idle") return "";
    if (scanState.status === "scanning") return "Scanning...";
    if (scanState.status === "success") return scanState.message;
    return scanState.message;
  }, [canAccess, scanState]);

  const onScanClick = useCallback(() => {
    if (!canAccess) return;

    const webApp = getTelegramWebApp();
    if (!webApp?.showScanQrPopup) {
      setScanState({
        status: "error",
        message: "QR scan not available. Open inside Telegram (mobile) and ensure permissions.",
      });
      return;
    }

    setScanState({ status: "scanning" });

    webApp.showScanQrPopup({ text: "Scan Stamply QR" }, (qrText) => {
      setLastScan(qrText);

      const customerId = parseCustomerIdFromQrText(qrText);
      if (!customerId) {
        setScanState({
          status: "error",
          message: 'Invalid QR. Expected format: "visit_<customerId>"',
        });
        return true;
      }

      createVisit({
        variables: { input: { customerId } },
        refetchQueries: [{ query: OWNER_DASHBOARD }],
      })
        .then(() => {
          setScanState({ status: "success", message: "Stamp added" });
        })
        .catch((err: unknown) => {
          setScanState({
            status: "error",
            message: userMessageFromUnknown(err),
          });
        });

      return true; // close popup
    });
  }, [canAccess, createVisit]);

  if (!canAccess) {
    return (
      <div>
        <h1>Staff Panel</h1>
        <div>Staff only.</div>
      </div>
    );
  }

  return (
    <div>
      <h1>Staff Panel</h1>
      <button onClick={onScanClick} disabled={visitLoading}>
        Scan QR
      </button>
      {statusText ? <div>{statusText}</div> : null}
      {lastScan ? (
        <pre>{JSON.stringify({ lastScan }, null, 2)}</pre>
      ) : null}
    </div>
  );
}

