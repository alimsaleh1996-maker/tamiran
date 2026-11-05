import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSiteSessionLogout,
  buildSiteSessionStart,
  siteDispatchSignOutPath,
} from "../app/software/auth-session-adapter.ts";

test("UI-AUTH-01 restore uses the authoritative session action and CSRF header", () => {
  const token = "TEST-TAMIRAN-1011Z-A09-AUTH-CSRF";
  const request = buildSiteSessionStart(token);
  assert.equal(request.method, "POST");
  assert.deepEqual(request.headers, {
    "Content-Type": "application/json",
    "X-CSRF-Token": token,
  });
  assert.deepEqual(JSON.parse(request.body), { action: "begin_site_session" });
  assert.throws(() => buildSiteSessionStart(""));
  assert.throws(() => buildSiteSessionStart("x".repeat(513)));
});

test("UI-AUTH-02 logout retains CSRF and uses dispatch-owned top-level sign-out path", () => {
  const token = "TEST-TAMIRAN-1011Z-A09-AUTH-CSRF";
  assert.deepEqual(buildSiteSessionLogout(token), {
    method: "DELETE",
    headers: { "X-CSRF-Token": token },
  });
  assert.equal(siteDispatchSignOutPath, "/signout-with-chatgpt?return_to=%2F");
  assert.throws(() => buildSiteSessionLogout(""));
});
