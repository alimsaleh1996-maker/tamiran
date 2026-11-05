# Tamiran — Codex / ECC

## GitHub destination selected by the user — 2026-11-05

- The user requested a repository in their own GitHub account and publication of future Tamiran code changes there. The chosen destination is `alimsaleh1996-maker/tamiran`, with private visibility and branch `main`.
- The clean GitHub checkout is prepared at `/workspace/repos/tamiran`. Prefer that checkout for future Tamiran development once the remote repository is available. This supersedes historical migration notes requiring all development to remain exclusively in the Sites repository.
- Current connection can identify the GitHub account, but repository creation returned `403 Resource not accessible by integration`. Repository creation and the initial push are pending; do not claim that the code has been uploaded until a remote readback confirms it.
- For subsequent authorized changes, run relevant checks, commit the reviewed source and push to this GitHub destination. Report the commit URL. Respect concurrent remote work; use fast-forward updates, never a force push.
- Keep the existing Sites `origin`, project ID and audience unchanged. Publishing source to GitHub does not authorize deployment to the live Site or the user's PHP host, a visibility change, or scheduled jobs.
- Do not publish generated config, installation keys, runtime secrets, logs, uploads, backups, local databases, dependency directories, or historical source archives. The GitHub import starts with a clean snapshot rather than the Sites Git history.

This repository contains three distinct surfaces:
- Root `dist/` is the currently configured static demonstration.
- `migration/worker/` is the React 19 / TypeScript / Vinext application being migrated to Cloudflare Workers and D1.
- `hosting/` is the standalone PHP 8.2 / MySQL shared-hosting edition requested by the user. Its `public_html/` and `private/` are siblings. Read `hosting/INSTALL-FA.md` and `hosting/VERIFICATION-FA.md` before working on that edition.

Read `migration/README.md`, `migration/progress.json`, and `migration/QA-MATRIX.md` before implementation. Existing reports are historical evidence, not proof that checks passed in the current environment.

Use the installed ECC workflows when relevant: `security-review`, `production-audit`, `verification-loop`, and React/TypeScript review guidance. Native role definitions are in `.codex/config.toml`; select only the roles required for the task. Keep the session's model and permission defaults.

## Project constraints

- Preserve the Site project ID and access policy. A review or local configuration request does not authorize publication or enabling scheduled jobs.
- `migration/worker/baseline/` and baseline-manifest hashes preserve the reference product. Do not edit them or re-freeze hashes to make a failing test pass; intentional parity changes require an explicit implementation plan.
- Do not send requests to legacy staging, DirectAdmin, cPanel, or real customer databases. Use synthetic fixtures for local checks; never send real SMS or payments.
- In the Worker edition enforce Sites identity; in the PHP hosting edition use its own authenticated PHP sessions. Both require active membership, role, shop, and branch scope on the server. UI role selection is not authorization.
- Keep receipt allocation, version checks, business changes, events, and audits atomic. Preserve idempotent retries and rollback behavior.
- Preserve Persian RTL, existing-device contracts, integer rial amounts, and Persian-display/UTC-storage date semantics.

## Verification

- Root foundation: `node --test tests/site-foundation.test.mjs`.
- Worker: inspect `tests/` before execution. Most `.test.mjs` suites run with `node --test`; `workflow.test.mjs` and source-preservation use their own summaries. D1 schema/repository tests use Node SQLite; Wrangler readback wrappers require a successful build, migrations, and fresh synthetic local state.
- Use the pinned `pnpm@11.25.0` lockfile for dependency installation; do not silently switch lockfile formats.
- Type check: from `migration/worker`, `node node_modules/typescript/bin/tsc --noEmit`.
- For Sites implementation/publishing, follow the Sites skill and its build helper. If that helper is unavailable, record the limitation; standalone checks cannot certify a hosted deployment.
- Report source tests, local storage checks, browser E2E, and hosted verification separately. Never infer readiness from passing unit tests alone.
- Hosting edition: rebuild browser assets from `hosting/frontend` with its own pinned npm lockfile; run `npm run typecheck` and `npm run build`. PHP tests are in `hosting/tests`; HTTP integration tests refuse remote hosts and use synthetic isolated SQL data. Keep runtime `private/config.php`, logs, keys, uploads and backups out of Git and release source. The packaging script intentionally creates a new private installation key per ZIP.

Latest ECC review: `migration/reviews/2026-10-21-ecc-review.md`.
