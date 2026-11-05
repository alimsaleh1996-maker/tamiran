#!/usr/bin/env python3
"""Build a clean shared-host install ZIP and a separate editable source ZIP."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import secrets
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text().strip()
STAMP = (2026, 10, 24, 0, 0, 0)
PRIVATE = (
    ".htaccess", "install.php", "config.example.php", "v2-core.php",
    "product-service.php", "capability-service.php", "backup-engine.php",
    "sms-service.php", "database/schema.sql",
    "captcha-audio.php", "captcha-audio/CREDITS.json",
    *(f"captcha-audio/{digit}.wav" for digit in range(2, 10)),
)
DOCS = ("VERSION", "README.md", "INSTALL-FA.md", "VERIFICATION-FA.md", "THIRD-PARTY-NOTICES.txt", "UPGRADE-FA.md", "UI-FIXES-FA.md")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def required(path: Path) -> bytes:
    if not path.is_file() or path.is_symlink():
        raise SystemExit(f"Missing/non-regular release input: {path.relative_to(ROOT)}")
    return path.read_bytes()


def runtime_files() -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for name in PRIVATE:
        files["private/" + name] = required(ROOT / "private" / name)
    for name in DOCS:
        files[name] = required(ROOT / name)
    public = ROOT / "public_html"
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
    metadata = {
        "version": VERSION, "target": "php-mysql-shared-hosting",
        "php_minimum": "8.2", "schema_sha256": digest(files["private/database/schema.sql"]),
        "frontend_entry_sha256": digest(files["public_html/index.php"]),
        "api_files": 38, "install_mode": "empty-database-only",
    }
    files["private/build/manifest.json"] = (json.dumps(metadata, ensure_ascii=False, indent=2) + "\n").encode()
    # Unique per delivered package. It is never echoed or stored in the source tree.
    files["private/install.key"] = (secrets.token_hex(32) + "\n").encode()
    return files


def source_files(base: dict[str, bytes]) -> dict[str, bytes]:
    files = dict(base)
    # Editable source carries no install authorization token. The web installer
    # can generate a private key on first access, or a new package creates one.
    files.pop("private/install.key", None)
    for name in ("frontend", "scripts", "tests", "dev"):
        directory = ROOT / name
        for path in sorted(directory.rglob("*")):
            rel = path.relative_to(ROOT)
            if any(part in {"node_modules", ".build", "__pycache__"} for part in rel.parts):
                continue
            if path.is_symlink():
                continue
            if path.is_file() and path.suffix not in {".log", ".pyc"}:
                files[rel.as_posix()] = path.read_bytes()
    files[".gitignore"] = required(ROOT / ".gitignore")
    return files


def update_files(base: dict[str, bytes]) -> dict[str, bytes]:
    """Application-only update: no config, SQL, installer or install token."""
    selected = {
        name: data for name, data in base.items()
        if name in {"VERSION", "UPGRADE-FA.md", "UI-FIXES-FA.md", "THIRD-PARTY-NOTICES.txt", "VERIFICATION-FA.md",
                    "public_html/index.php", "public_html/api/bootstrap.php", "public_html/api/health.php", "public_html/api/captcha.php",
                    "private/captcha-audio.php", "private/build/manifest.json"}
        or name.startswith(("public_html/assets/", "private/captcha-audio/"))
    }
    assert not any(name.startswith("public_html/install/") or name.endswith(".sql") or name == "private/install.key" for name in selected)
    return selected


def write_zip(path: Path, files: dict[str, bytes]) -> dict[str, object]:
    forbidden = ("private/config.php", "private/installed.lock")
    if any(name in files for name in forbidden):
        raise SystemExit("Refusing to package generated configuration")
    files = dict(files)
    files["CHECKSUMS.sha256"] = "".join(
        f"{digest(data)}  {name}\n" for name, data in sorted(files.items())
    ).encode()
    directories = sorted({str(parent) + "/" for name in files for parent in Path(name).parents if str(parent) != "."})
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for directory in directories:
            info = zipfile.ZipInfo(directory, STAMP)
            info.create_system = 3
            info.external_attr = ((0o40700 if directory.startswith("private/") else 0o40755) << 16) | 0x10
            archive.writestr(info, b"")
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, STAMP)
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    runtime = runtime_files()
    results = [
        write_zip(output / f"tamiran-{VERSION}-install.zip", runtime),
        write_zip(output / f"tamiran-{VERSION}-source.zip", source_files(runtime)),
    ]
    if VERSION == "2.0.0-php.2":
        results.append(write_zip(output / f"tamiran-{VERSION}-update-from-php.1.zip", update_files(runtime)))
    (output / f"tamiran-{VERSION}-artifacts.json").write_text(json.dumps(results, indent=2) + "\n")
    for result in results:
        print(f"{result['file']}  {result['bytes']} bytes  SHA256 {result['sha256']}")


if __name__ == "__main__":
    main()
