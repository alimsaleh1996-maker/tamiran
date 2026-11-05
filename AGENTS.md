# Tamiran — Codex / ECC

## GitHub destination selected by the user — 2026-11-05

- The user requested publication of Tamiran code changes to their GitHub account and then supplied `https://github.com/alimsaleh1996-maker/tamiran.git`. This is the canonical source destination, on branch `main`.
- The user-created repository was verified as public and empty on 2026-11-05, with push permission. Preserve its existing visibility unless the user explicitly requests a change.
- The GitHub checkout is `/workspace/repos/tamiran`; prefer it for future Tamiran development. This supersedes historical migration notes requiring all development to remain exclusively in the Sites repository.
- Repository creation initially failed with 403, then the user created the repository and authorized uploading to it. Verify the remote branch SHA after each push before reporting successful publication.
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

## Graphify project map

- `graphify-out/graph.json`, `graph.html` and `GRAPH_REPORT.md` contain the static architecture map. Start with `graphify-out/README-FA.md` for scope, commands and limitations. Use scoped graph queries for architecture questions and verify consequential findings in source.
- PHP hosting, the Worker migration and frozen PHP are separate runtime editions. Same-named functions do not prove calls between them. Twenty-two cross-edition heuristic call candidates were excluded and preserved in `EXCLUDED_RELATIONS.json`; do not restore them merely because the symbol names match.
- `GRAPH_HEALTH.json` records 110 unresolved raw endpoint references and 12 self-loops after the workflow AST refresh. Typed parallel relationships are retained in the exported multigraph. These diagnostics do not establish runtime bugs or security findings. See `WORKFLOW_REFRESH.json` for the current AST scope and pending semantic documents.
- The editable frontend sources are indexed; its generated `public_html/assets/index-*.js` bundle is excluded by `.graphifyignore`. Local graph caches, interpreter paths and intermediate extraction stay ignored.
- After source changes, refresh the graph with the installed `$graphify` skill, maintaining the edition boundary and reporting the current source revision and coverage. Do not install automatic hooks or deploy the site just to update this map.

## Ruflo development workflow

- The five-stage workflow is defined in `workflows/tamiran.json`; its operator guide is `docs/ruflo/WORKFLOW-FA.md`. Use `python3 scripts/tamiran_flow.py plan` and `doctor` to inspect the path and prerequisites.
- In an existing Codex session, use the host-directed `start`, `next`, `check`, and `record` commands. The `run` command starts separate sequential Codex CLI sessions; use it when automated execution is requested, never recursively from a workflow phase.
- Ruflo task tools persist coordination; actual work belongs to Codex and actual checks belong to the controller. Do not report a task as complete without its valid stage output and required check evidence. Never use wait-only placeholder stages as proof that development happened.
- The default `tooling` profile does not authorize application-code edits. Select `frontend-static` or `backend-local` for the appropriate scope and report unexecuted browser/HTTP/hosted checks honestly. A blocked review or failed check is not completion.
- Generated `.ruflo/` and `.claude-flow/` state stays ignored. The runner inherits model and permission settings, preserves the frozen reference, stops on failures, and does not commit, push, deploy or enable scheduled jobs. The parent session retains the user's standing GitHub publishing authorization after verification.
