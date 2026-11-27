#!/usr/bin/env python3
"""Build a clean shared-host install ZIP and a separate editable source ZIP."""
from __future__ import annotations

import argparse
import hashlib
from io import BytesIO
import json
from pathlib import Path
import re
import subprocess
import tarfile
from tempfile import TemporaryDirectory
import time
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RELEASE_BRANCH = "tamiran-v1/foundation"
UPDATE_FROM = {"1.0.0-rc.14": "1.0.0-rc.13", "1.0.0-rc.15": "1.0.0-rc.14", "1.0.0-rc.16": "1.0.0-rc.15", "1.0.0-rc.17": "1.0.0-rc.16", "1.0.0-rc.18": "1.0.0-rc.17", "1.0.0-rc.19": "1.0.0-rc.13", "1.0.0-rc.20": "1.0.0-rc.19"}
DEVICE_IDENTIFIERS_MIGRATION = "private/database/migrations/2.0.0-beta.8-device-identifiers.sql"
UPDATE_MIGRATIONS = dict.fromkeys(("1.0.0-rc.16", "1.0.0-rc.19"), DEVICE_IDENTIFIERS_MIGRATION)
MANIFEST = "private/build/manifest.json"
PRIVATE = (
    ".htaccess", "install.php", "config.example.php", "v2-core.php", "technician-service.php", "operations-policy.php", "external-purchase.php", "case-invoice.php", "manager-operations.php",
    "product-service.php", "capability-service.php", "catalog-similarity.php", "backup-engine.php",
    "sms-service.php", "database/schema.sql", DEVICE_IDENTIFIERS_MIGRATION.removeprefix("private/"),
    "captcha-audio.php", "captcha-audio/CREDITS.json",
    *(f"captcha-audio/{digit}.wav" for digit in range(2, 10)),
)
DOCS = ("VERSION", "README.md", "INSTALL-FA.md", "VERIFICATION-FA.md", "THIRD-PARTY-NOTICES.txt", "UPGRADE-FA.md", "UI-FIXES-FA.md")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def required(path: Path) -> bytes:
    if not path.is_file() or path.is_symlink():
        raise SystemExit(f"Missing/non-regular release input: {path}")
    return path.read_bytes()


def runtime_files(root: Path = ROOT) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for name in PRIVATE:
        files["private/" + name] = required(root / "private" / name)
    for name in DOCS:
        files[name] = required(root / name)
    public = root / "public_html"
    for path in sorted(public.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(public)
        allowed = (
            str(relative) in {"index.php", ".htaccess", "favicon.svg"}
            or (relative.parts[0] == "api" and len(relative.parts) == 2 and path.suffix == ".php")
            or (relative.parts[0] == "install" and path.suffix in {".php", ".css"})
            or (relative.parts[0] == "assets" and path.suffix in {".js", ".css", ".svg", ".woff", ".woff2", ".png", ".webp", ".ico"})
            or relative.as_posix() == "assets/captcha-audio-credits.txt"
        )
        if not allowed:
            raise SystemExit(f"Unexpected public file; review before packaging: {relative}")
        files["public_html/" + relative.as_posix()] = required(path)
    for name in ("public_html/index.php", "public_html/.htaccess", "public_html/install/index.php", "public_html/api/auth.php"):
        if name not in files:
            raise SystemExit(f"Missing required entrypoint: {name}")
    if sum(name.startswith("public_html/api/") for name in files) != 38:
        raise SystemExit("Expected exactly 38 PHP API files")
    if not any(name.endswith(".js") for name in files if name.startswith("public_html/assets/")):
        raise SystemExit("Build the frontend before packaging")
    return files


def source_files(base: dict[str, bytes], root: Path = ROOT) -> dict[str, bytes]:
    files = dict(base)
    for name in ("frontend", "scripts", "tests", "dev"):
        directory = root / name
        for path in sorted(directory.rglob("*")):
            rel = path.relative_to(root)
            if any(part in {"node_modules", ".build", "__pycache__"} for part in rel.parts):
                continue
            if path.is_symlink():
                continue
            if path.is_file() and path.suffix not in {".log", ".pyc"}:
                files[rel.as_posix()] = path.read_bytes()
    files[".gitignore"] = required(root / ".gitignore")
    return files


def update_files(base: dict[str, bytes], version: str | None = None) -> dict[str, bytes]:
    """Include only the migration explicitly associated with this update."""
    selected = {
        name: data for name, data in base.items()
        if name in {"VERSION", "UPGRADE-FA.md", "UI-FIXES-FA.md", "THIRD-PARTY-NOTICES.txt", "VERIFICATION-FA.md",
                    "public_html/index.php", "public_html/.htaccess", "public_html/favicon.svg", "private/.htaccess",
                    "private/v2-core.php", "private/technician-service.php", "private/operations-policy.php", "private/external-purchase.php", "private/case-invoice.php", "private/manager-operations.php", "private/product-service.php", "private/capability-service.php", "private/catalog-similarity.php",
                    "private/backup-engine.php", "private/sms-service.php", "private/captcha-audio.php", "private/build/manifest.json"}
        or name.startswith(("public_html/assets/", "public_html/api/", "private/captcha-audio/"))
    }
    assert not any(name.startswith("public_html/install/") or name.endswith(".sql") or name == "private/install.key" for name in selected)
    if migration := UPDATE_MIGRATIONS.get(version):
        selected[migration] = base[migration]
    return selected


def write_zip(path: Path, files: dict[str, bytes], stamp: tuple[int, ...]) -> dict[str, object]:
    forbidden = ("private/config.php", "private/installed.lock", "private/install.key")
    if any(name in files for name in forbidden):
        raise SystemExit("Refusing to package generated configuration")
    files = dict(files)
    files["CHECKSUMS.sha256"] = "".join(
        f"{digest(data)}  {name}\n" for name, data in sorted(files.items())
    ).encode()
    directories = sorted({str(parent) + "/" for name in files for parent in Path(name).parents if str(parent) != "."})
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for directory in directories:
            info = zipfile.ZipInfo(directory, stamp)
            info.create_system = 3
            info.external_attr = ((0o40700 if directory.startswith("private/") else 0o40755) << 16) | 0x10
            archive.writestr(info, b"")
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, stamp)
            info.create_system = 3
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o100600 if name.startswith("private/") else 0o100644) << 16
            archive.writestr(info, data)
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise SystemExit("ZIP integrity check failed")
        actual = {name: archive.read(name) for name in archive.namelist() if not name.endswith("/")}
        assert actual == files
    return {"file": path.name, "sha256": digest(path.read_bytes()), "bytes": path.stat().st_size, "files": len(files)}


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(ROOT.parents[1]), *args])


def release_source(expected_commit: str) -> tuple[str, str, tuple[int, ...]]:
    branch = git("branch", "--show-current").decode().strip()
    commit = git("rev-parse", "HEAD").decode().strip()
    if branch != RELEASE_BRANCH:
        raise SystemExit(f"Release packaging requires the {RELEASE_BRANCH} branch.")
    if not re.fullmatch(r"[0-9a-f]{40}", expected_commit) or expected_commit != commit:
        raise SystemExit("Release packaging requires the full, approved SHA matching HEAD.")
    if git("status", "--porcelain", "--untracked-files=normal"):
        raise SystemExit("Release packaging requires a clean checkout.")
    committed_at = int(git("show", "-s", "--format=%ct", commit))
    return branch, commit, tuple(time.gmtime(committed_at)[:6])


def release_version(root: Path) -> str:
    version = required(root / "VERSION").decode().strip()
    package = json.loads(required(root / "frontend/package.json"))
    lock = json.loads(required(root / "frontend/package-lock.json"))
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?", version) or any(
        candidate != version for candidate in (
            required(root.parent / "VERSION").decode().strip(),
            package["version"], lock["version"], lock["packages"][""]["version"],
        )
    ):
        raise SystemExit("Application version and frontend package metadata disagree.")
    return version


def release_manifest(files: dict[str, bytes], version: str, branch: str, commit: str) -> bytes:
    schema = re.search(rb"tamiran_schema_versions\(version\) VALUES \('([^']+)'\)", files["private/database/schema.sql"])
    if schema is None:
        raise SystemExit("Cannot determine the installed schema version from schema.sql.")
    frontend = {
        name: digest(data) for name, data in sorted(files.items())
        if name in {"public_html/index.php", "public_html/favicon.svg"} or name.startswith("public_html/assets/")
    }
    backend = {
        name: digest(data) for name, data in sorted(files.items())
        if name == "VERSION" or name.startswith("public_html/api/") or (
            name.startswith("private/") and name.endswith(".php")
            and name not in {"private/install.php", "private/config.example.php"}
        )
    }
    previous = UPDATE_FROM.get(version)
    migration = UPDATE_MIGRATIONS.get(version)
    metadata = {
        "format": 1,
        "version": version,
        "frontend_version": version,
        "backend_version": version,
        "git": {"branch": branch, "commit": commit, "dirty": False},
        "target": "php-mysql-shared-hosting",
        "requirements": {
            "php_minimum": "8.2", "php_extensions": ["pdo_mysql", "mbstring", "openssl", "json", "session", "zlib"],
            "mysql_minimum": "8.0", "mariadb_minimum": "10.6", "https": True,
        },
        "paths": {"document_root": "public_html/", "private": "private/", "install": "INSTALL-FA.md", "update": "UPGRADE-FA.md"},
        "install_mode": "empty-database-only",
        "update": {"from_version": previous, "database_migration": migration is not None} if previous else None,
        "schema_version": schema[1].decode(),
        "schema_sha256": digest(files["private/database/schema.sql"]),
        "files": {"frontend": frontend, "backend": backend},
        "frontend_entry_sha256": frontend["public_html/index.php"],
    }
    if migration:
        metadata["update"]["migration"] = {"path": migration, "sha256": digest(files[migration])}
    metadata["build_id"] = digest(json.dumps(metadata, sort_keys=True).encode())[:16]
    return (json.dumps(metadata, ensure_ascii=False, indent=2) + "\n").encode()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--commit", required=True, help="Full approved SHA of the checked-out release branch")
    args = parser.parse_args()
    output = args.output.resolve()
    branch, commit, stamp = release_source(args.commit)
    with TemporaryDirectory(prefix="tamiran-release-") as staging:
        archive = git("archive", commit, "--", "tamiran-v1/VERSION", "tamiran-v1/hosting")
        with tarfile.open(fileobj=BytesIO(archive)) as tree:
            tree.extractall(staging, filter="data")
        root = Path(staging) / "tamiran-v1" / "hosting"
        version = release_version(root)
        runtime = runtime_files(root)
        source = source_files(runtime, root)
        subprocess.run(["npm", "ci", "--ignore-scripts"], cwd=root / "frontend", check=True)
        subprocess.run(["npm", "run", "build"], cwd=root / "frontend", check=True)
        if runtime_files(root) != runtime:
            raise SystemExit("Rebuilt runtime differs from the approved commit. Commit the current build first.")
        manifest = release_manifest(runtime, version, branch, commit)
        runtime[MANIFEST] = manifest
        source[MANIFEST] = manifest
        output.mkdir(parents=True, exist_ok=True)
        results = [
            write_zip(output / f"tamiran-{version}-install.zip", runtime, stamp),
            write_zip(output / f"tamiran-{version}-source.zip", source, stamp),
        ]
        if previous := UPDATE_FROM.get(version):
            results.append(write_zip(output / f"tamiran-{version}-update-from-{previous.removeprefix('1.0.0-')}.zip", update_files(runtime, version), stamp))
    release = json.loads(manifest)
    for result in results:
        result.update({"version": version, "git": release["git"], "build_id": release["build_id"],
                       "build_manifest_sha256": digest(manifest)})
    (output / f"tamiran-{version}-artifacts.json").write_text(json.dumps(results, indent=2) + "\n")
    for result in results:
        print(f"{result['file']}  {result['bytes']} bytes  SHA256 {result['sha256']}")


if __name__ == "__main__":
    main()
