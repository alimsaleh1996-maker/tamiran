export type ActiveReceiptTerms = {
  publicId: string;
  versionNumber: number;
  title: string;
  bodyText: string;
  contentSha256: string;
  effectiveFrom: string;
};

export type ReceiptAcceptance = {
  publicId: string;
  contentSha256: string;
  accepted: true;
};

export type PreviousDeviceSelection = {
  previousDeviceId?: number;
  expectedDeviceVersion?: number;
};

export type DraftSubmissionSelection = {
  draftPublicId?: string;
  draftExpectedVersion?: number;
};

function textField(
  source: Record<string, unknown>,
  camelName: string,
  snakeName: string,
): string {
  const value = source[camelName] ?? source[snakeName];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("نسخه فعال شرایط پذیرش معتبر نیست.");
  }
  return value;
}

function positiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error("نسخه فعال شرایط پذیرش معتبر نیست.");
  }
  return Number(value);
}

export function parseActiveReceiptTerms(
  input: unknown,
): ActiveReceiptTerms | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("نسخه فعال شرایط پذیرش معتبر نیست.");
  }
  const source = input as Record<string, unknown>;
  const contentSha256 = textField(
    source,
    "contentSha256",
    "content_sha256",
  );
  if (!/^[a-f0-9]{64}$/.test(contentSha256)) {
    throw new Error("نسخه فعال شرایط پذیرش معتبر نیست.");
  }
  return {
    publicId: textField(source, "publicId", "public_id"),
    versionNumber: positiveInteger(
      source.versionNumber ?? source.version_number,
    ),
    title: textField(source, "title", "title"),
    bodyText: textField(source, "bodyText", "body_text"),
    contentSha256,
    effectiveFrom: textField(source, "effectiveFrom", "effective_from"),
  };
}

export function receiptTermsKey(terms: ActiveReceiptTerms): string {
  return `${terms.publicId}:${terms.contentSha256}`;
}

export function buildReceiptAcceptance(
  terms: ActiveReceiptTerms | null,
  acceptedTermsKey: string,
): ReceiptAcceptance {
  if (!terms) {
    throw new Error("نسخه فعال شرایط پذیرش برای این تعمیرگاه آماده نیست.");
  }
  if (acceptedTermsKey !== receiptTermsKey(terms)) {
    throw new Error(
      "پیش از ثبت، متن نسخه فعال شرایط پذیرش را به مشتری نشان دهید و پذیرش حضوری او را تأیید کنید.",
    );
  }
  return {
    publicId: terms.publicId,
    contentSha256: terms.contentSha256,
    accepted: true,
  };
}

export function buildPreviousDeviceSelection(
  device: { id: number; expectedDeviceVersion?: number } | null,
): PreviousDeviceSelection {
  if (!device) return {};
  if (!Number.isSafeInteger(device.id) || device.id < 1) {
    throw new Error("شناسه دستگاه قبلی معتبر نیست.");
  }
  if (!Number.isSafeInteger(device.expectedDeviceVersion) || Number(device.expectedDeviceVersion) < 0)
    throw new Error("نسخه دستگاه قبلی معتبر نیست؛ سابقه را دوباره دریافت کنید.");
  return { previousDeviceId: device.id, expectedDeviceVersion: device.expectedDeviceVersion };
}

export function buildDraftSubmissionSelection(
  draft: { publicId: string; version: number } | null,
): DraftSubmissionSelection {
  if (!draft) return {};
  if (
    typeof draft.publicId !== "string" ||
    !draft.publicId.trim() ||
    draft.publicId.length > 26
  ) {
    throw new Error("شناسه پیش‌نویس پذیرش معتبر نیست.");
  }
  if (!Number.isSafeInteger(draft.version) || draft.version < 0) {
    throw new Error("نسخه پیش‌نویس پذیرش معتبر نیست.");
  }
  return {
    draftPublicId: draft.publicId,
    draftExpectedVersion: draft.version,
  };
}
