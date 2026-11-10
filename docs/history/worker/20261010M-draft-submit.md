# 20261010M — ادامه و تطبیق تبدیل اتمیک پیش‌نویس

Base source opened with official helper: `5a4dec35713eabd2d3707705b7b8d5579167c5ed`. Same owner-private Site. Root remains static checkpoint; API candidate is not hosted operational software.

## Root cause and reconciliation

Prior interrupted working tree was based on 958bd10 and contained an alternate 0006 migration/draft implementation. Remote had advanced through customer lookup and versioned/audited encrypted drafts (20261010L). Official helper refused overwriting remote work. Opened latest remote in a fresh checkout and retained its seven migrations, encrypted envelope, lock_version, digest, owner/branch scope, audit and HTTP read contracts. Old working tree retained for reference; its alternate 0006 and router were not published. Its local D1 success does not establish compatibility of the latest schema. Re-ran latest official local D1 storage test on a fresh DB.

No UI/baseline/menu/schema/migration files changed in this run. Prior pending CSRF implementation remains unmerged and must be reviewed against the current dispatcher in a later bounded step; no claim it is active. Customer lookup branch-history contract remains exactly the remote baseline; this run does not change visibility policy.

## Implemented behavior

create_case now accepts draftPublicId + draftExpectedVersion together; incomplete pair is 400. Repository reads an active, unexpired draft belonging to the same shop/branch/creator and reception idempotency key at the explicit version. It guards the exact encrypted payload/digest/version in the atomic reception batch, then submits the draft against that newly created case, increments draft version and verifies one changed row. Receipt allocation, customer/device/case/workflow/events/acceptance/token/audit and draft submission commit or roll back together. Case creation audit remains part of this batch.

Request fingerprint includes draft ID and displayed draft version. Successful retry returns existing case without rewriting draft or allocating a second receipt; altered/omitted draft ID or altered version conflicts. Submitted drafts remain excluded from active listing and cannot be edited via draft CRUD. Failed conversion leaves the prior active draft and receipt counter untouched. Independent intervening edit/discard is retained while the attempted reception is rolled back. Draft payload is an editable wizard snapshot: final submitted form fields are validated by existing reception rules, rather than silently replacing them with stored draft values.

## Evidence and expected/actual

- `node --experimental-strip-types --test tests/reception-draft-submit.test.mjs`: 5/5 passed. SUBMIT-01 success/read-only retry/conflicting fingerprint/no overwrite; 02 owner/branch/key/version/expiry denied with unchanged graph; 03 injected submit failure rolls back all graph tables/receipt/draft; 04 intervening edit and discard retain independent writer and abort reception; 05 Request/Response dispatcher success/retry and required version.
- Regression command: `node --experimental-strip-types --test tests/customer-lookup-http.test.mjs tests/d1-case-core.test.mjs tests/d1-schema.test.mjs tests/reception*.test.mjs tests/source-preservation.test.mjs tests/workflow.test.mjs`: 141/141 Node entries passed, comprising 139 inline scenarios and two script wrappers. Workflow wrapper runs 55 separate baseline checks. Initial regression failure expected 503 for an incomplete draft conversion; updated the obsolete assertion to the new required-pair 400 and reran successfully.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0. Official `build-site.mjs` in worker: exit 0. Targeted eslint on changed implementation/tests: exit 0, zero warnings. Root site-foundation: passed.
- `node --experimental-strip-types --test tests/d1-drafts-readback.test.mjs`: 1/1 passed; fresh official local D1 applies seven unchanged schema files + clearly synthetic seeds and verifies envelope/policy storage, raw JSON/cross-shop/identity denials, unchanged readback and zero foreign-key violations. This is storage/constraint testing, not a network transaction test.
- Frozen source preservation verifies 67 hashes, 20 menus and 27 frontend API paths. No staging, real customer, SMS or payment operations.

## Practical effect and limits

Reception can safely convert a reviewed saved draft at the repository/handler layer. Technician, manager workflow, finance, inventory, customer portal and UI behavior unchanged. Development adapter must send current draft version with the ID. No new migration or release. All transactions tested with SQLite-compatible adapter; actual distributed Worker concurrency, hosted D1/identity, persistent runtime key, CSRF integration, initial operations/capabilities, reception UI adapter, browser/mobile/print and end-to-end roles remain unverified. Pilot readiness not approved.

Next bounded step: initialization/scoped case contracts and adapter, or reconcile CSRF into current HTTP dispatcher with explicit regression coverage. Keep same Site/access and source checkpoint; do not publish incomplete Worker over static demo.
