"""Meaningful checks for scoped navigation, graph fidelity and offline HTML safety."""
from pathlib import Path
import importlib.util
import hashlib
import json
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('project_map', ROOT/'scripts/build_project_map.py')
viewer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(viewer)


class ProjectMapTests(unittest.TestCase):
    def test_relocated_historical_evidence_exists_with_expected_checksums(self):
        manifest=json.loads((ROOT/'docs/project/relocations.json').read_text())
        targets=set()
        for item in manifest['files']:
            with self.subTest(path=item['to']):
                target=ROOT/item['to']
                self.assertNotIn(item['to'],targets)
                targets.add(item['to'])
                self.assertTrue(target.is_file())
                self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(),item['relocated_sha256'])
                if target.suffix!='.md': self.assertEqual(item['original_sha256'],item['relocated_sha256'])

    def test_editions_and_private_database_are_distinct(self):
        expected = {
            'hosting/private/schema.sql': 'hosting.database',
            'hosting/private/v2-core.php': 'hosting.services',
            'hosting/frontend/src/app/tamiran/page.tsx': 'hosting.ui',
            'hosting/public_html/api/bootstrap.php': 'hosting.api',
            'hosting/private/install.php': 'hosting.install',
            'migration/worker/baseline/private/schema.sql': 'reference.frozen',
            'migration/worker/src/lib/server/auth.ts': 'worker.server',
            'docs/reports/hosting/test.png': 'docs.reports',
            'docs/history/worker/run.md': 'docs.history',
        }
        for path, module in expected.items():
            with self.subTest(path=path): self.assertEqual(viewer.module_for(path), module)

    def fixture(self):
        temp = tempfile.TemporaryDirectory(prefix='TEST-TAMIRAN-map-')
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        (root/'graphify-out').mkdir(); (root/'scripts').mkdir()
        shutil.copytree(ROOT/'scripts/project_map', root/'scripts/project_map')
        subprocess.run(['git','init','--quiet'],cwd=root,check=True)
        return root

    def test_builder_preserves_parallel_relations_and_escapes_embedded_text(self):
        root=self.fixture()
        graph={'nodes':[{'id':'a','label':'</script><script>alert(1)</script>','source_file':'hosting/private/a.php'},
                        {'id':'b','source_file':'hosting/private/b.php'}],
               'links':[{'source':'a','target':'b','relation':'calls','confidence':'EXTRACTED'},
                        {'source':'a','target':'b','relation':'uses','confidence':'INFERRED'}]}
        (root/'graphify-out/graph.json').write_text(json.dumps(graph))
        result=viewer.build(root)
        self.assertEqual(result['nodes_embedded'],2)
        self.assertEqual(result['typed_relationships_embedded'],2)
        html=(root/'graphify-out/graph.html').read_text()
        self.assertNotIn('</script><script>alert(1)</script>',html)
        self.assertIn('\\u003c/script>',html)
        self.assertNotIn('/*__VIEWER__*/',html)
        self.assertNotIn('<script src=',html)

    def test_unknown_endpoint_and_duplicate_node_fail_before_export(self):
        for graph in [{'nodes':[{'id':'a'},{'id':'a'}],'links':[]},
                      {'nodes':[{'id':'a'}],'links':[{'source':'a','target':'missing'}]}]:
            with self.subTest(graph=graph):
                root=self.fixture(); (root/'graphify-out/graph.json').write_text(json.dumps(graph))
                with self.assertRaises(ValueError): viewer.build(root)
                self.assertFalse((root/'graphify-out/graph.html').exists())

    def test_inventory_obeys_gitignore_and_excludes_runtime(self):
        root=self.fixture(); (root/'.gitignore').write_text('.ruflo/\n.env*\n')
        (root/'.ruflo').mkdir(); (root/'.ruflo/private.txt').write_text('TEST private')
        (root/'.env.test').write_text('TEST private')
        (root/'docs').mkdir(); (root/'docs/README.md').write_text('guide')
        files=viewer.inventory(root)
        self.assertIn('docs/README.md',files)
        self.assertFalse(any(f.startswith(('.ruflo/','.env')) for f in files))


if __name__ == '__main__': unittest.main()
