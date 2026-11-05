# 20261010A — پایه دیتابیس هویت و مشتری

- Source HEAD at opening: `8033b950253c65a5233fd76577fa93b1091a8bec`.
- Scope: first bounded part of d1-core, on owner-private Site appgprj_6abc1a7567b48191a56163caace8160f. No staging or external SMS/payment.
- Root cause: candidate schema was empty; planner facts and operational data could not be persisted. No application endpoint is marked implemented by this change.
- Tables: repair_shops, repair_branches, tamiran_users, tamiran_user_branches, repair_customers. All 77 frozen legacy columns, indexes and FK scopes retained. Nullable account_user_id prepares verified server identity mapping; it does not grant roles. Central role scope follows baseline auth.php:232–234. Partial central unique indexes prevent NULL shop scope defeating identity uniqueness.
- SQLite-specific checks enforce legacy enums, lengths, booleans, JSON, nonnegative safe integers. Case/receipt uniqueness and session/role authorization are NOT implemented yet. UTC text date storage, Persian UI, currency unit and original menu/API behavior unchanged. updated_at is explicitly written by future repository operations; SQLite has no MySQL ON UPDATE timestamp behavior.
- Schema-only official `drizzle-kit generate` output and metadata committed. Seed remains outside migration. Candidate DB binding configured in migration/worker only; root publication is still static, no hosted DB migration or operational candidate deployed.

## Evidence

| Check | Expected | Actual |
|---|---|---|
| `node --test tests/d1-schema.test.mjs` | valid writes accepted; cross-shop FKs, duplicates, invalid JSON/enums/numbers denied; failed transaction rolled back | 22/22 passed on fresh in-memory Node SQLite databases |
| `node --experimental-strip-types tests/workflow.test.mjs` | baseline unit/parity/security checks pass | 55/55 passed |
| `node tests/source-preservation.test.mjs` | frozen source/menu/API paths unchanged | 67 hashes, 20 menu items, 27 consumed API paths verified |
| `node node_modules/typescript/bin/tsc --noEmit` | typecheck | exit 0 |
| official Sites build helper in migration/worker | candidate builds with DB binding | exit 0; build passed |
| documented Wrangler `d1 execute DB --local ... --file drizzle/0000_organic_whirlwind.sql` | apply schema to new isolated local D1 | 24 statements successful |
| `node tests/d1-local.test.mjs` | seed and D1 denial/readback smoke | INCOMPLETE: write_stdin reported "network approval was cancelled before a decision was returned"; no retry/bypass. Local inspection proves seed was persisted, but remaining assertions are not claimed passed |
| `node tests/d1-local-readback.test.mjs` | read-only storage has synthetic records and valid FKs | 2 shops, 7 role types, 8 users, 7 memberships, 2 customers, zero FK violations, receipt counter 0 |
| root `node tests/site-foundation.test.mjs` | retained private static publication warning/assets separation | recorded by source packaging step |

Initial schema test 1 failed because its regex skipped leading whitespace before legacy id. Test reader corrected; all 22 rerun passed. No schema change was needed for this test failure.

Fixture family `TEST-TAMIRAN-1010A-*`; names «آزمایشی — …», nontelephone TEST-MOBILE strings, unusable placeholder password hashes and synthetic account bindings. There is no actual login, invitation, SMS, payment or operational reception in these fixtures. They never go into hosted migrations or deployed assets.

## Limits and continuation

D1 CLI smoke interruption is an execution-access limit, not a confirmed product failure. Hosted D1, authenticated role-based API, E2E, receipt retries/concurrency, browser/mobile/print and recovery remain not-run/blocked. Do not mark pilot ready. No user action is needed to continue other ready technical steps; preserve development automation.

Next bounded task: append catalog/device/case/workflow/event/audit schema with required shop/branch/customer/actor relationships, receipt uniqueness and idempotency, then repository batch operations and server-side scope. Treat applied local 0000 and its metadata as immutable. Recreate seed only in fresh local state; no destructive cleanup or schema DDL inside request handlers.

## Candidate input fingerprints

- `migration/worker/db/schema.ts`: `99761d3451993e43dd969d1c8972aed350b555c0232267a3cd799ce196158f63`
- `migration/worker/drizzle/0000_organic_whirlwind.sql`: `3d248aa87220ca5a9d4fa43b70a0f779c1d129472dc8cd01761b765cce4f6a3a`
- `migration/worker/tests/d1-schema.test.mjs`: `d83b90fb30759098b0440512c4f10c0a2c44378cb6e4ed6f52c6857733197a5e`
- `migration/worker/tests/fixtures/d1-identity.sql`: `36ec6a7a4716505745ec60def715151d05dfada4bb2592f048074da725e95b33`
