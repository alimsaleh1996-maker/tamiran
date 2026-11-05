import type { CaseFollowUp, FollowUpStatus } from "./followups";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    message?: string;
    tracking_code?: string;
  };
};

export class FollowUpApiError extends Error {
  trackingCode?: string;

  constructor(message: string, trackingCode?: string) {
    super(message);
    this.name = "FollowUpApiError";
    this.trackingCode = trackingCode;
  }
}

// This source tree is the DirectAdmin build. Keep the flag runtime-safe instead
// of relying on Vite's import.meta.env replacement in a prebuilt browser bundle.
export const directAdminApiEnabled = true;

let csrfToken: string | null = null;

async function parseResponse<T>(response: Response): Promise<T> {
  if (
    !(response.headers.get("content-type") ?? "").includes("application/json")
  ) {
    throw new FollowUpApiError(
      "پاسخ نامعتبر از سرور دریافت شد.",
      response.headers.get("X-Request-ID") ?? undefined,
    );
  }
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new FollowUpApiError(
      payload.error?.message ?? "ارتباط با سرور انجام نشد.",
      payload.error?.tracking_code ??
        response.headers.get("X-Request-ID") ??
        undefined,
    );
  }
  return payload.data;
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/csrf.php", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const data = await parseResponse<{ csrf_token: string }>(response);
  csrfToken = data.csrf_token;
  return csrfToken;
}

export async function loadFollowUps(): Promise<CaseFollowUp[] | null> {
  if (!directAdminApiEnabled) return null;
  const response = await fetch("/api/followups.php", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  return parseResponse<CaseFollowUp[]>(response);
}

async function mutateFollowUp(
  input:
    | CaseFollowUp
    | {
        id: string;
        status?: FollowUpStatus;
        assignedToUserId?: number;
        dueLabel?: string;
        comment?: string;
      },
  method: "POST" | "PATCH",
  retry = true,
): Promise<CaseFollowUp> {
  const token = await getCsrfToken();
  const response = await fetch("/api/followups.php", {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": token,
    },
    body: JSON.stringify(input),
  });
  if (response.status === 419 && retry) {
    csrfToken = null;
    return mutateFollowUp(input, method, false);
  }
  return parseResponse<CaseFollowUp>(response);
}

export async function createFollowUp(
  item: CaseFollowUp,
): Promise<CaseFollowUp> {
  if (!directAdminApiEnabled) return item;
  return mutateFollowUp(item, "POST");
}

export async function updateFollowUp(input: {
  id: string;
  status?: FollowUpStatus;
  assignedToUserId?: number;
  dueLabel?: string;
  comment?: string;
}): Promise<CaseFollowUp> {
  if (!directAdminApiEnabled)
    throw new FollowUpApiError("API دایرکت‌ادمین فعال نیست.");
  return mutateFollowUp(input, "PATCH");
}

export const updateFollowUpStatus = (id: string, status: FollowUpStatus) =>
  updateFollowUp({ id, status });
