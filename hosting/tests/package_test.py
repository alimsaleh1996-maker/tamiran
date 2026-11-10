#!/usr/bin/env python3
"""Check that an application update carries the full runtime but no private data."""
import importlib.util
from pathlib import Path
import unittest

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
                'private/v2-core.php', 'private/product-service.php', 'private/capability-service.php',
                'private/backup-engine.php', 'private/sms-service.php', 'private/captcha-audio.php'):
                self.assertEqual(update.get(name), data, name)

    def test_update_excludes_installation_and_runtime_secrets(self):
        update = package.update_files(package.runtime_files())
        for name in update:
            self.assertFalse(name.endswith('.sql'), name)
            self.assertFalse(name.startswith('public_html/install/'), name)
            self.assertNotIn(name, ('private/install.key', 'private/config.php', 'private/installed.lock'))


if __name__ == '__main__':
    unittest.main()
