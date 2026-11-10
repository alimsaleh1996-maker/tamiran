# 20261010N — CSRF احرازشده پذیرش و پیش‌نویس

Opened source with official Sites helper: `aaf2a8e93f74f602deaf9112d49f7a9f2ca19d15`. Same owner-private Site. No staging/customer/SMS/payment operations. Root remains static demo plus progress, not an operational Worker publication.

## Cause, scope and contract

Original frontend gets GET `/api/csrf.php` and sends `X-CSRF-Token`, then refreshes once after HTTP 419. Migrated write handlers previously enforced same-origin JSON and real server membership but lacked this token contract. Added scoped GET and enforced token verification on `create_case`, `save_reception_draft`, `discard_reception_draft`, including direct use of create handler. Other APIs remain fail-closed. No UI, frozen baseline, schema, migrations or workflow changed.

GET csrf accepts only optional branchId, resolves official Sites account and DB membership, requires reception/manager, rejects external Origin or Sec-Fetch-Site cross-site, and returns `{ok:true,data:{csrf_token}}` with no-store. Missing stable server key is 503. Multi-branch users without explicit selection receive 409; no fabricated default branch. No DB write or logged raw token.

Token uses existing AES-GCM crypto with a separate csrf subject bound to account ID/user ID/branch and shop in authenticated encryption context. Random IV; eight-hour issued/expiry envelope. Missing/oversized/tampered/wrong-key/wrong-account/user/shop/branch/future-issued/expired or malformed lifetime returns 419. Server identity, roles, license and active membership are still checked per write; a previously valid token cannot override revoked authority. Origin/JSON/body bounds remain enforced. create dispatcher reads body once and reconstructs a bounded request for existing create handler, preserving prior no-clone behavior.

This is stateless CSRF, not original PHP session storage. Single-active-session, logout/revocation and session lifecycle remain to be migrated separately; do not claim session security complete. Token may be reused within its lifetime by the same authorized scope. Encryption key must be persistent and server-only, not generated per request or placed in frontend/source; hosted key is still unconfigured. UI adapter must pass selected branch when obtaining/renewing CSRF and reset its cached token on scope change. Original API helper's 419 refresh behavior is preserved, but branch adapter/browser behavior is not yet integrated or tested.

## Tests and evidence

`node --experimental-strip-types --test tests/reception-csrf.test.mjs`: 9/9 passed.

- CSRF-01 scoped opaque/random GET/no-store/no mutation, accepted before eight hours and rejected exactly at expiry.
- 02 missing/tampered/truncated/oversized/foreign key/future issue denied.
- 03 account/user/shop/branch binding.
- 04 encrypted invalid lifetimes fail.
- 05 external GET origins/fetch, duplicate/forged parameters, anonymous and forbidden roles denied.
- 06 missing persistent key rejects issuance and all write types without writes.
- 07 missing/bad/expired tokens reject all write types and direct create handler, unchanged data readback.
- 08 valid token succeeds save/discard/create/read-only replay; another user's manager token rejected.
- 09 token cannot bypass selected branch or revoked membership; multi-branch unspecified selection returns 409.

Existing HTTP tests now obtain an actual token from the actual scoped GET handler using test-only `fixtures/csrf-http.mjs`. No runtime bypass, optional verification flag or mock successful CSRF path added. Dedicated security tests call raw handlers without this test wrapper to verify denial. Existing legitimate create/draft/retry/rollback tests pass with real token verification.

Regression command: `node --experimental-strip-types --test tests/customer-lookup-http.test.mjs tests/d1-case-core.test.mjs tests/d1-schema.test.mjs tests/reception*.test.mjs tests/source-preservation.test.mjs tests/workflow.test.mjs`: 150/150 Node entries, consisting of 148 inline scenarios + two script wrappers. Workflow wrapper independently runs 55 baseline checks. Source preservation verifies 67 hashes, 20 menus and 27 frontend API paths. TypeScript noEmit exit 0, official worker build passed, changed-file eslint exit 0 without warnings, root site-foundation passed. Seven migration files unchanged; no new D1 CLI run necessary for this HTTP/crypto-only change, and no claim made of new storage verification. Prior local D1 evidence remains in 20261010M/L.

## Effect and remaining work

Reception requires scoped valid CSRF for writes; manager uses own scope token. Technician/finance/inventory/customer business operations unchanged. No manual data-entry burden added; frontend already has token acquisition/refresh logic, pending selected-branch adapter. Security token errors remain sanitized and tracked. No release/real pilot approved.

Next: initial reception operations/scoped case list, capability contract and UI adapter (branch selection/CSRF cache, draft version, terms version/hash, optimistic device version), then hosted DB/key/identity/network testing and full role E2E. Browser/mobile/print, distributed Worker concurrency, technician/customer/financial lifecycle and session policy remain unverified.
