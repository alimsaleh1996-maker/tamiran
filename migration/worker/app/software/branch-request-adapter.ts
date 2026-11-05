export type BranchContextOption = {
  branchId: number;
  branchCode: string;
  branchName: string;
  isDefault: boolean;
  role: string;
  shopName: string;
  publicShopCode: string;
  licenseStatus: string;
};

export type BranchSelection = {
  branchId: number | null;
  source: "url" | "storage" | "none";
};

export type AdaptedBranchRequest = {
  input: RequestInfo | URL;
  init?: RequestInit;
  adapted: boolean;
};

const apiPath = /^\/api\/[a-z0-9-]+\.php$/;

export function positiveBranchId(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (!/^[1-9]\d*$/.test(value)) throw new Error("شناسه شعبه معتبر نیست.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("شناسه شعبه معتبر نیست.");
  return parsed;
}

export function readBranchSelection(currentUrl: string, stored: string | null): BranchSelection {
  const url = new URL(currentUrl);
  const explicit = url.searchParams.getAll("branchId");
  if (explicit.length > 1) throw new Error("انتخاب شعبه تکراری است.");
  if (explicit.length === 1) {
    return { branchId: positiveBranchId(explicit[0]), source: "url" };
  }
  if (stored !== null) {
    return { branchId: positiveBranchId(stored), source: "storage" };
  }
  return { branchId: null, source: "none" };
}

export function branchSelectionUrl(currentUrl: string, branchId: number): string {
  if (!Number.isSafeInteger(branchId) || branchId < 1)
    throw new Error("شناسه شعبه معتبر نیست.");
  const url = new URL(currentUrl);
  url.searchParams.set("branchId", String(branchId));
  return url.toString();
}

function requestUrl(input: RequestInfo | URL, origin: string): URL {
  if (input instanceof Request) return new URL(input.url);
  return new URL(String(input), origin);
}

function copiedRequestInit(request: Request, body?: BodyInit): RequestInit {
  return {
    method: request.method,
    headers: new Headers(request.headers),
    body,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity,
    keepalive: request.keepalive,
    mode: request.mode,
    signal: request.signal,
  };
}

function assertQueryBranch(url: URL, branchId: number) {
  const values = url.searchParams.getAll("branchId");
  if (values.length > 1) throw new Error("دامنه شعبه درخواست مبهم است.");
  if (values.length === 1 && positiveBranchId(values[0]) !== branchId)
    throw new Error("دامنه شعبه درخواست با فضای کاری جاری یکسان نیست.");
}

export async function adaptBranchRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  branchId: number,
  origin: string,
): Promise<AdaptedBranchRequest> {
  if (!Number.isSafeInteger(branchId) || branchId < 1)
    throw new Error("شناسه شعبه معتبر نیست.");
  const url = requestUrl(input, origin);
  if (url.origin !== origin || !apiPath.test(url.pathname)) {
    return { input, init, adapted: false };
  }

  assertQueryBranch(url, branchId);
  const request = input instanceof Request
    ? new Request(input, init)
    : new Request(url, init);
  const method = request.method.toUpperCase();
  const contentType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (!["GET", "HEAD"].includes(method) && contentType === "application/json") {
    const text = await request.clone().text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("بدنه JSON درخواست معتبر نیست.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("بدنه JSON درخواست باید یک شیء باشد.");
    const body = parsed as Record<string, unknown>;
    if (
      body.branchId !== undefined &&
      (!Number.isSafeInteger(body.branchId) || body.branchId !== branchId)
    ) {
      throw new Error("دامنه شعبه بدنه با فضای کاری جاری یکسان نیست.");
    }
    // Write handlers accept the authoritative branch only in the validated JSON body.
    url.searchParams.delete("branchId");
    return {
      input: new Request(
        url,
        copiedRequestInit(request, JSON.stringify({ ...body, branchId })),
      ),
      adapted: true,
    };
  }

  url.searchParams.set("branchId", String(branchId));
  const rawBody = ["GET", "HEAD"].includes(method)
    ? undefined
    : await request.clone().arrayBuffer();
  return {
    input: new Request(url, copiedRequestInit(request, rawBody)),
    adapted: true,
  };
}

export function installBranchFetchAdapter(branchId: number): () => void {
  const originalFetch = window.fetch;
  const origin = window.location.origin;
  const adaptedFetch: typeof window.fetch = async (input, init) => {
    const adapted = await adaptBranchRequest(input, init, branchId, origin);
    return originalFetch.call(window, adapted.input, adapted.init);
  };
  window.fetch = adaptedFetch;
  return () => {
    if (window.fetch === adaptedFetch) window.fetch = originalFetch;
  };
}
