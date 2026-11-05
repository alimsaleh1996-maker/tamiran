import { z } from "zod";
import { readActorContext } from "./actor-context.ts";
import {
  beginActiveAppSession,
  clearSessionCookie,
  randomSessionSecret,
  releaseActiveAppSession,
  sessionCookie,
  verifyAuthCsrf,
} from "./auth-session.ts";
import {
  boundedJson,
  type ReceptionHttpDependencies,
} from "./reception-http.ts";
import { ReceptionError } from "./reception-repository.ts";
import { utcDate } from "./reception-terms.ts";
import { resolveServerScope, ScopeError } from "./server-scope.ts";

type Dependencies = ReceptionHttpDependencies & {
  newPublicId?: () => string;
  newRequestId?: () => string;
  newSessionSecret?: () => string;
};

const positive = z.number().int().positive().safe();
const beginSchema = z
  .object({
    action: z.literal("begin_site_session"),
    branchId: positive.optional(),
  })
  .strict();
const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function publicId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26);
}

function failure(error: unknown, requestId: string): Response {
  const known = error instanceof ScopeError || error instanceof ReceptionError;
  return Response.json(
    {
      ok: false,
      error: {
        message: known ? error.message : "مدیریت نشست تعمیران انجام نشد.",
        tracking_code: requestId,
      },
    },
    { status: known ? error.status : 500, headers: responseHeaders },
  );
}

function assertSameOrigin(request: Request, url: URL): void {
  if (
    request.headers.get("Origin") !== url.origin ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    throw new ScopeError("مبدأ درخواست معتبر نیست.", 403);
}

function logoutQuery(url: URL): void {
  for (const key of url.searchParams.keys()) {
    if (key !== "branchId" || url.searchParams.getAll(key).length !== 1)
      throw new ScopeError("پارامتر درخواست معتبر نیست.", 400);
  }
  const branch = url.searchParams.get("branchId");
  if (
    branch !== null &&
    (!/^[1-9]\d*$/u.test(branch) || !Number.isSafeInteger(Number(branch)))
  )
    throw new ScopeError("شناسه شعبه معتبر نیست.", 400);
}

export function createAuthSessionHttpHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const requestId = deps.newRequestId?.() ?? crypto.randomUUID();
    try {
      const url = new URL(request.url);
      if (url.pathname !== "/api/auth.php")
        throw new ScopeError("این API هنوز منتقل نشده است.", 503);
      if (!['POST', 'DELETE'].includes(request.method))
        throw new ScopeError("روش درخواست مجاز نیست.", 405);
      assertSameOrigin(request, url);
      const now = deps.now();
      utcDate(now);
      const user = await deps.getUser();
      if (!user) throw new ScopeError("ورود با حساب ChatGPT الزامی است.", 401);
      const db = await deps.getDb();
      if (!db) throw new ScopeError("پایگاه داده آماده نیست.", 503);
      const key = await deps.getKey();
      if (!key) throw new ReceptionError("کلید امن نشست تنظیم نشده است.", 503);
      await verifyAuthCsrf(
        key,
        user,
        request.headers.get("X-CSRF-Token"),
        now,
      );
      const evidence = {
        requestId,
        ipAddress: (request.headers.get("CF-Connecting-IP") ?? "").slice(0, 45),
        userAgent: request.headers.get("User-Agent")?.slice(0, 500) ?? null,
        now,
        newPublicId: deps.newPublicId ?? publicId,
      };

      if (request.method === "DELETE") {
        logoutQuery(url);
        const result = await releaseActiveAppSession(db, user, request, evidence);
        const headers = new Headers(responseHeaders);
        headers.set("Set-Cookie", clearSessionCookie());
        return Response.json(
          { ok: true, data: { signed_out: true, replayed: result.replayed } },
          { headers },
        );
      }

      if (url.search) throw new ScopeError("پارامتر نشانی مجاز نیست.", 400);
      if (
        request.headers
          .get("Content-Type")
          ?.split(";", 1)[0]
          .trim()
          .toLowerCase() !== "application/json"
      )
        throw new ScopeError("نوع بدنه باید JSON باشد.", 415);
      const parsed = beginSchema.safeParse(await boundedJson(request, 4_096));
      if (!parsed.success)
        throw new ReceptionError("درخواست آغاز نشست معتبر نیست.", 400);
      const branchId = parsed.data.branchId ?? null;
      const context = await readActorContext(
        db,
        user,
        branchId,
        now.slice(0, 10),
      );
      if (!context.actor || context.requiresContext)
        throw new ScopeError("انتخاب شعبه برای این حساب الزامی است.", 409);

      const headers = new Headers(responseHeaders);
      if (context.actor.isCentralAdmin) {
        headers.set("Set-Cookie", clearSessionCookie());
        return Response.json(
          {
            ok: true,
            data: {
              ...context,
              session: {
                restored: true,
                replaced: false,
                singleActive: false,
              },
            },
          },
          { headers },
        );
      }

      const scope = await resolveServerScope(db, user, {
        branchId,
        today: now.slice(0, 10),
      });
      const session = await beginActiveAppSession(db, user, scope, request, {
        ...evidence,
        newSecret: deps.newSessionSecret ?? randomSessionSecret,
      });
      if (session.cookie) headers.set("Set-Cookie", sessionCookie(session.cookie));
      return Response.json(
        {
          ok: true,
          data: {
            ...context,
            session: {
              restored: session.restored,
              replaced: session.replaced,
              singleActive: true,
            },
          },
        },
        { headers },
      );
    } catch (error) {
      return failure(error, requestId);
    }
  };
}
