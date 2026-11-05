# Tamiran standalone browser application

This is a separately maintained copy of the preserved Tamiran interface. It calls the PHP APIs on the same origin with cookie sessions. Node is needed only when rebuilding the browser assets, never on the hosting server. No ChatGPT or Cloudflare account is required at runtime.

Build with Node 22.18+:

```sh
cd hosting/frontend
npm ci --ignore-scripts
npm run typecheck
npm run build
```

The build writes `hosting/public_html/index.php`, `favicon.svg` and `assets/` without removing API or installer files. On a new host, `index.php` redirects to `/install/` until `hosting/private/config.php` exists. Serve `public_html` as the document root; keep `private` outside it.

For this development checkout, `node_modules` may be a symlink to the existing migration Worker dependencies. That symlink is local build tooling and must not be uploaded. Upload only the packaged PHP application and generated browser assets.

The hosting PHP APIs expose draft `version`, accept `expectedVersion` for draft edits/discard, and accept `draftExpectedVersion` when submitting. Previous-device lookups expose `expectedDeviceVersion`; the browser sends that version when reusing a device. Displayed receipt acceptance is sent as `{publicId, contentSha256, accepted: true}` and must match the active terms on the server. This browser build must be distributed with the matching hosting API copies, not the frozen migration baseline.

Reception draft fixes in this copy: submission pauses autosave and awaits in-flight work; previous-device choice and assignment are saved/restored, with device ownership refreshed from lookup; customer lookup preserves restored draft edits.

Workflow cases route technician assignment through `/api/workflow-v2.php` (`action: assign`), preserving the backend's official reassignment/handover policy. Legacy case PATCH is used only for legacy assignments. The operations snapshot exposes a real case offset page, and the UI displays authorized total counts, page limits and previous/next controls. Headline dashboard summary values come from the full scoped server aggregates; charts/search using the listed case page are labeled accordingly.

The generated PHP entrypoint enforces the same HTTPS/trusted-proxy policy as the APIs before rendering the credential form. Untrusted plain HTTP receives status 426 and a generic Persian instruction. The explicitly configured loopback development exception remains available through the shared backend helper.
