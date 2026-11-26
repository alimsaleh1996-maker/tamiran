#!/usr/bin/env python3
"""Check that an application update carries the full runtime but no private data."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('tamiran_packager', root / 'scripts' / 'package.py')
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class UpgradePackageTests(unittest.TestCase):
    def test_update_carries_all_runtime_api_and_private_services(self):
        runtime = package.runtime_files()
        update = package.update_files(runtime)
        for name, data in runtime.items():
            if name.startswith('public_html/api/') or name in (
                'private/v2-core.php', 'private/technician-service.php', 'private/product-service.php', 'private/capability-service.php',
                'private/backup-engine.php', 'private/sms-service.php', 'private/captcha-audio.php'):
                self.assertEqual(update.get(name), data, name)

    def test_update_excludes_installation_and_runtime_secrets(self):
        update = package.update_files(package.runtime_files())
        for name in update:
            self.assertFalse(name.endswith('.sql'), name)
            self.assertFalse(name.startswith('public_html/install/'), name)
            self.assertNotIn(name, ('private/install.key', 'private/config.php', 'private/installed.lock'))

    def test_manifest_identifies_commit_and_runtime_without_private_state(self):
        runtime = package.runtime_files()
        version = package.release_version(root)
        commit = 'a' * 40
        manifest = json.loads(package.release_manifest(runtime, version, package.RELEASE_BRANCH, commit))
        self.assertEqual(manifest['git'], {'branch': package.RELEASE_BRANCH, 'commit': commit, 'dirty': False})
        self.assertEqual(manifest['frontend_version'], version)
        self.assertEqual(manifest['backend_version'], version)
        self.assertEqual(manifest['schema_sha256'], package.digest(runtime['private/database/schema.sql']))
        self.assertEqual(manifest['update']['from_version'], '1.0.0-rc.13')
        self.assertRegex(manifest['build_id'], '^[0-9a-f]{16}$')
        self.assertNotEqual(
            manifest['build_id'],
            json.loads(package.release_manifest(runtime, version, package.RELEASE_BRANCH, 'b' * 40))['build_id'],
        )
        update = package.update_files(runtime)
        for part in manifest['files'].values():
            for name, sha in part.items():
                self.assertEqual(package.digest(update[name]), sha, name)
            self.assertNotIn('private/config.php', part)
            self.assertNotIn('private/install.key', part)

    def test_requires_clean_release_branch_and_approved_commit(self):
        commit = 'a' * 40
        for branch, approved, status, message in (
            ('main', commit, b'', 'requires the tamiran-v1/foundation branch'),
            (package.RELEASE_BRANCH, 'b' * 40, b'', 'approved SHA'),
            (package.RELEASE_BRANCH, commit, b' M VERSION\n', 'clean checkout'),
        ):
            with self.subTest(message=message), patch.object(
                package, 'git', side_effect=[branch.encode(), commit.encode(), status],
            ):
                with self.assertRaisesRegex(SystemExit, message):
                    package.release_source(approved)

    def test_accepts_matching_clean_commit(self):
        commit = 'a' * 40
        with patch.object(package, 'git', side_effect=[package.RELEASE_BRANCH.encode(), commit.encode(), b'', b'1795730400']):
            branch, built_commit, _ = package.release_source(commit)
        self.assertEqual(branch, package.RELEASE_BRANCH)
        self.assertEqual(built_commit, commit)


if __name__ == '__main__':
    unittest.main()
