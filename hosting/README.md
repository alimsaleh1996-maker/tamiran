# Tamiran PHP hosting edition

Release: **2.0.0-php.2**. Standalone shared-hosting distribution built from the preserved Tamiran PHP/MySQL business backend and an adapted browser build of the existing twenty-menu interface.

Start with [INSTALL-FA.md](INSTALL-FA.md). The install archive places `public_html/` and `private/` side by side. The server needs PHP 8.2+ and MySQL 8 / MariaDB 10.6+, with no Node, Cloudflare or ChatGPT runtime dependency. Domain-root deployment is required.

For an existing `2.0.0-php.1` installation, use the application-only update ZIP and [UPGRADE-FA.md](UPGRADE-FA.md). It contains no SQL, installer, generated config or runtime keys. See [UI-FIXES-FA.md](UI-FIXES-FA.md) for the six interface fixes and the Persian audio CAPTCHA.

The PHP edition has its own files here. The frozen reference in `migration/worker/baseline` and the Worker migration are preserved.

- `public_html/`: browser assets, PHP API, initial installer, Apache rules.
- `private/`: runtime services, installer library, SQL schema, configuration example. Generated config and runtime data are not included in releases.
- `frontend/`: editable React/TypeScript browser source and pinned build dependencies; Node is needed only to rebuild assets.
- `tests/`: local synthetic integration and security checks.
- `scripts/package.py`: creates clean install and source ZIPs, a private installation key, file checksums and build metadata.
- `VERIFICATION-FA.md`: test evidence and limits for the packaged release.

To rebuild the browser interface, use `npm ci --ignore-scripts`, `npm run typecheck` and `npm run build` from `frontend/`. To package, run `python scripts/package.py --output /absolute/output/directory` from this directory after completing verification. Packaging refuses missing runtime files and excludes generated credentials, local logs, uploads, backups, dependencies and test state.

The initial installer only accepts an empty dedicated database and does not upgrade existing installations. Do not overwrite an existing `private/config.php`, encryption key or runtime-secret directory during upgrades.
