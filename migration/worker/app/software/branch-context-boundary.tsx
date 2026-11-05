"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  branchSelectionUrl,
  installBranchFetchAdapter,
  readBranchSelection,
  type BranchContextOption,
} from "./branch-request-adapter";

type ActorContextData = {
  actor: null | {
    id: number;
    isCentralAdmin: boolean;
    branch: null | { id: number };
  };
  requiresContext: boolean;
  contexts: BranchContextOption[];
};

type Envelope = {
  ok: boolean;
  data?: ActorContextData;
  error?: { message?: string; tracking_code?: string };
};

const storageKey = "tamiran:selected-branch";

function contextLabel(context: BranchContextOption) {
  return `${context.shopName} — ${context.branchName}`;
}

async function loadContext(branchId: number | null): Promise<ActorContextData> {
  const url = new URL("/api/auth.php", window.location.origin);
  if (branchId !== null) url.searchParams.set("branchId", String(branchId));
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json"))
    throw new Error("پاسخ هویت از سرور معتبر نیست.");
  const body = (await response.json()) as Envelope;
  if (!response.ok || !body.ok || !body.data) {
    const suffix = body.error?.tracking_code
      ? ` · کد رهگیری ${body.error.tracking_code}`
      : "";
    throw new Error(`${body.error?.message ?? "فضای کاری قابل بازیابی نیست."}${suffix}`);
  }
  return body.data;
}

export function BranchContextBoundary({ children }: { children: ReactNode }) {
  const [resolved, setResolved] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [contexts, setContexts] = useState<BranchContextOption[]>([]);
  const [error, setError] = useState("");
  const uninstallRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    let active = true;
    const start = async () => {
      const parameters = new URLSearchParams(window.location.search);
      if (parameters.has("portal") || parameters.has("track")) {
        if (active) setBypass(true);
        return;
      }
      try {
        let selection = readBranchSelection(
          window.location.href,
          window.sessionStorage.getItem(storageKey),
        );
        let data: ActorContextData;
        try {
          data = await loadContext(selection.branchId);
        } catch (cause) {
          if (selection.source !== "storage") throw cause;
          window.sessionStorage.removeItem(storageKey);
          selection = { branchId: null, source: "none" };
          data = await loadContext(null);
        }
        if (!active) return;
        setContexts(data.contexts);
        if (data.actor) {
          const authoritativeBranch = data.actor.branch?.id ?? null;
          if (authoritativeBranch !== null)
            window.sessionStorage.setItem(storageKey, String(authoritativeBranch));
          else window.sessionStorage.removeItem(storageKey);
          uninstallRef.current?.();
          uninstallRef.current = authoritativeBranch === null
            ? null
            : installBranchFetchAdapter(authoritativeBranch);
          setBranchId(authoritativeBranch);
          setResolved(true);
          return;
        }
        if (data.requiresContext && data.contexts.length > 0) return;
        throw new Error("هیچ فضای کاری مجازی برای این حساب پیدا نشد.");
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : "بازیابی فضای کاری انجام نشد.");
      }
    };
    void start();
    return () => {
      active = false;
      uninstallRef.current?.();
      uninstallRef.current = null;
    };
  }, []);

  const choose = (value: string) => {
    const selected = contexts.find((context) => String(context.branchId) === value);
    if (!selected) {
      setError("شعبه انتخاب‌شده در دسترسی‌های فعلی وجود ندارد.");
      return;
    }
    window.sessionStorage.setItem(storageKey, String(selected.branchId));
    window.location.assign(branchSelectionUrl(window.location.href, selected.branchId));
  };

  if (bypass) return children;
  if (error)
    return (
      <main dir="rtl" style={{ maxWidth: 720, margin: "64px auto", padding: 24 }}>
        <h2>فضای کاری تعمیران باز نشد</h2>
        <p>{error}</p>
        <p>دسترسی، عضویت و شعبه باید در دیتابیس معتبر باشند.</p>
      </main>
    );
  if (!resolved && contexts.length > 0)
    return (
      <main dir="rtl" style={{ maxWidth: 720, margin: "64px auto", padding: 24 }}>
        <h2>انتخاب شعبه</h2>
        <p>برای ادامه، یکی از شعب مجاز این حساب را انتخاب کنید.</p>
        <label style={{ display: "grid", gap: 8 }}>
          <span>فضای کاری مجاز</span>
          <select defaultValue="" onChange={(event) => choose(event.target.value)}>
            <option value="" disabled>انتخاب کنید</option>
            {contexts.map((context) => (
              <option key={`${context.publicShopCode}:${context.branchId}`} value={context.branchId}>
                {contextLabel(context)} · {context.role}
              </option>
            ))}
          </select>
        </label>
      </main>
    );
  if (!resolved)
    return (
      <main dir="rtl" style={{ maxWidth: 720, margin: "64px auto", padding: 24 }}>
        <p>در حال بررسی دسترسی و شعبه جاری…</p>
      </main>
    );

  return (
    <>
      {contexts.length > 1 && branchId !== null ? (
        <aside dir="rtl" style={{ padding: 12, background: "#eef6ff", color: "#17324d" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>شعبه جاری:</span>
            <select value={branchId} onChange={(event) => choose(event.target.value)}>
              {contexts.map((context) => (
                <option key={`${context.publicShopCode}:${context.branchId}`} value={context.branchId}>
                  {contextLabel(context)}
                </option>
              ))}
            </select>
          </label>
        </aside>
      ) : null}
      {children}
    </>
  );
}
