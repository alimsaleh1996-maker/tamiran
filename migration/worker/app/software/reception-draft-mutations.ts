export type ReceptionDraftReference = {
  publicId: string;
  version: number;
};

export type ReceptionDraftDiscardSelection = {
  publicId: string;
  expectedVersion: number;
};

export type ReceptionDraftSaveRequest = {
  action: "save_reception_draft";
  idempotencyKey: string;
  payload: Record<string, unknown>;
  expectedVersion?: number;
};

export type ReceptionDraftDiscardRequest = {
  action: "discard_reception_draft";
  publicId: string;
  expectedVersion: number;
};

function checkedDraftReference(
  draft: ReceptionDraftReference,
): ReceptionDraftReference {
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
  return { publicId: draft.publicId, version: draft.version };
}

export function buildDraftDiscardSelection(
  draft: ReceptionDraftReference | null,
): ReceptionDraftDiscardSelection {
  if (!draft) {
    throw new Error("پیش‌نویس ذخیره‌شده‌ای برای حذف پیدا نشد.");
  }
  const checked = checkedDraftReference(draft);
  return {
    publicId: checked.publicId,
    expectedVersion: checked.version,
  };
}

export function buildDraftSaveRequest(
  idempotencyKey: string,
  payload: Record<string, unknown>,
  expectedVersion?: number,
): ReceptionDraftSaveRequest {
  if (!idempotencyKey.trim() || idempotencyKey.length > 160) {
    throw new Error("شناسه پیش‌نویس پذیرش معتبر نیست.");
  }
  if (
    expectedVersion !== undefined &&
    (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)
  ) {
    throw new Error("نسخه پیش‌نویس پذیرش معتبر نیست.");
  }
  return {
    action: "save_reception_draft",
    idempotencyKey,
    payload,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
  };
}

export function buildDraftDiscardRequest(
  draft: ReceptionDraftReference,
): ReceptionDraftDiscardRequest {
  const selection = buildDraftDiscardSelection(draft);
  return {
    action: "discard_reception_draft",
    ...selection,
  };
}

export function isDraftVersionConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 409
  );
}

export type ReceptionDraftMutationQueue = ReturnType<
  typeof createReceptionDraftMutationQueue
>;

export function createReceptionDraftMutationQueue(
  initial: ReceptionDraftReference | null = null,
) {
  let current = initial ? checkedDraftReference(initial) : null;
  let paused = false;
  let pending: Promise<void> = Promise.resolve();

  return {
    current(): ReceptionDraftReference | null {
      return current ? { ...current } : null;
    },
    replace(next: ReceptionDraftReference | null) {
      current = next ? checkedDraftReference(next) : null;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    enqueueSave(
      save: (
        expectedVersion: number | undefined,
      ) => Promise<ReceptionDraftReference>,
    ): Promise<ReceptionDraftReference | null> {
      const operation = pending.then(async () => {
        if (paused) return null;
        const saved = checkedDraftReference(
          await save(current?.version),
        );
        current = saved;
        return { ...saved };
      });
      pending = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    async settled() {
      await pending;
    },
  };
}
