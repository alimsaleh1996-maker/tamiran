export const siteDispatchSignOutPath = "/signout-with-chatgpt?return_to=%2F";

export function buildSiteSessionStart(authCsrfToken: string): RequestInit {
  if (!authCsrfToken || authCsrfToken.length > 512)
    throw new Error("نشست امن ورود معتبر نیست.");
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": authCsrfToken,
    },
    body: JSON.stringify({ action: "begin_site_session" }),
  };
}

export function buildSiteSessionLogout(authCsrfToken: string): RequestInit {
  if (!authCsrfToken || authCsrfToken.length > 512)
    throw new Error("نشست امن خروج معتبر نیست.");
  return {
    method: "DELETE",
    headers: { "X-CSRF-Token": authCsrfToken },
  };
}
