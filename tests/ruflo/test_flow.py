"""Workflow behavior tests. Model execution uses an explicitly fake local CLI.

Set TAMIRAN_RUFLO_INTEGRATION=1 for the additional real Ruflo task persistence
test. It never starts a model, SMS, database or remote service.
"""
from pathlib import Path
import contextlib
import copy
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('tamiran_flow', SOURCE / 'scripts/tamiran_flow.py')
flow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flow)


class Tasks:
    def __init__(self):
        self.tasks = {}
        self.calls = []

    def call(self, tool, args):
        args = copy.deepcopy(args)
        self.calls.append((tool, args))
        if tool == 'task_list':
            return {'tasks': copy.deepcopy(list(self.tasks.values()))}
        if tool == 'task_create':
            task_id = f'task-{len(self.tasks) + 1}'
            self.tasks[task_id] = {**args, 'taskId': task_id, 'status': 'pending'}
            return {'taskId': task_id}
        task = self.tasks[args['taskId']]
        if tool == 'task_complete':
            task.update(status='completed', result=args['result'])
            return copy.deepcopy(task)
        if tool == 'task_update':
            task.update(args)
            return copy.deepcopy(task)
        if tool == 'task_status':
            return copy.deepcopy(task)
        raise AssertionError(tool)


class FlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='TEST-TAMIRAN-flow-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'workflows').mkdir()
        (self.root / 'allowed').mkdir()
        (self.root / 'allowed/source.txt').write_text('original\n')
        (self.root / '.gitignore').write_text('.ruflo/\n.claude-flow/\n__pycache__/\n')
        config = json.loads((SOURCE / 'workflows/tamiran.json').read_text())
        config['profiles'] = {'tooling': {'description': 'TEST fixture checks', 'allowed_paths': ['allowed/', 'workflows/'],
                                       'requires': ['python3'], 'checks': [
                                           {'name': 'actual-process', 'cwd': '.', 'argv': [sys.executable, '-c', 'print("real check process ran")']}]}}
        (self.root / 'workflows/tamiran.json').write_text(json.dumps(config))
        shutil.copy2(SOURCE / 'workflows/result.schema.json', self.root / 'workflows/result.schema.json')
        subprocess.run(['git', 'init', '--quiet'], cwd=self.root, check=True)
        subprocess.run(['git', 'add', '.'], cwd=self.root, check=True)
        self.tasks = Tasks()
        self.flow = flow.Flow(self.root, self.tasks)

    def result(self, outcome='pass'):
        path = self.flow.runtime / 'manual-result.json'
        flow.atomic_json(path, {'outcome': outcome, 'summary': 'TEST evidence from the host', 'findings': [], 'tests': [], 'risks': []})
        return path

    def state(self):
        return self.flow.start('TEST workflow; preserve the application', 'tooling')

    def advance(self, state, count):
        for _ in range(count):
            current = self.flow.current(state)
            if current['id'] == 'test':
                self.flow.checks(state)
            self.flow.record(state, current['id'], self.result())

    def fake_codex(self, mode='pass'):
        binary = self.root / '.ruflo/bin/codex'
        binary.parent.mkdir(parents=True, exist_ok=True)
        code = f'''#!{sys.executable}
import json,sys,pathlib,time
args=sys.argv[1:]
prompt=sys.stdin.read()
root=pathlib.Path(args[args.index('--cd')+1])
(root/'.ruflo/argv.json').write_text(json.dumps(args))
(root/'.ruflo/prompt.txt').write_text(prompt)
mode={mode!r}
if mode=='fail': sys.exit(9)
if mode=='timeout': time.sleep(5)
if mode=='mutate': (root/'allowed/source.txt').write_text('unexpected edit')
result={{'outcome':'blocked' if mode=='blocked' else 'pass','summary':'FAKE Codex fixture output; no model executed','findings':[],'tests':[],'risks':[]}}
pathlib.Path(args[args.index('--output-last-message')+1]).write_text(json.dumps(result))
'''
        binary.write_text(code)
        binary.chmod(0o755)
        return patch.dict(os.environ, {'PATH': str(binary.parent) + os.pathsep + os.environ['PATH']})

    def test_start_persists_five_real_task_ids_and_order(self):
        state = self.state()
        self.assertEqual(len(self.tasks.tasks), 5)
        self.assertEqual(self.flow.load(state['run'])['stages'][0]['task_id'], 'task-1')
        self.assertIn('research', self.tasks.tasks['task-1']['tags'])
        self.assertEqual(self.flow.current(state)['id'], 'research')

    def test_unsafe_run_id_and_escaped_paths_rejected(self):
        with self.assertRaises(flow.FlowError):
            self.flow.path('../outside')
        with self.assertRaises(flow.FlowError):
            flow.contained(self.root, '../outside')

    def test_unknown_profile_empty_task_and_wrong_definition_rejected(self):
        with self.assertRaises(flow.FlowError):
            self.flow.start('task', 'unknown')
        with self.assertRaises(flow.FlowError):
            self.flow.start(' ', 'tooling')
        data = self.flow.definition
        data['stages'].reverse()
        (self.root / 'workflows/tamiran.json').write_text(json.dumps(data))
        with self.assertRaises(flow.FlowError):
            flow.Flow(self.root)

    def test_stages_cannot_be_skipped_or_completed_twice(self):
        state = self.state()
        with self.assertRaises(flow.FlowError):
            self.flow.record(state, 'review', self.result())
        self.advance(state, 1)
        with self.assertRaises(flow.FlowError):
            self.flow.record(state, 'research', self.result())

    def test_completed_artifact_tampering_is_detected(self):
        state = self.state()
        self.advance(state, 1)
        (self.root / state['stages'][0]['artifact']).write_text('{}')
        with self.assertRaises(flow.FlowError):
            self.flow.load(state['run'])

    def test_definition_changes_require_new_run(self):
        state = self.state()
        path = self.root / 'workflows/tamiran.json'
        path.write_text(path.read_text() + '\n')
        with self.assertRaises(flow.FlowError):
            flow.Flow(self.root).load(state['run'])

    def test_partial_setup_resumes_without_duplicating_saved_tasks(self):
        original = self.tasks.call
        counter = 0

        def intermittent(tool, args):
            nonlocal counter
            if tool == 'task_create':
                counter += 1
                if counter == 3:
                    raise flow.FlowError('TEST interrupted setup')
            return original(tool, args)

        self.tasks.call = intermittent
        with self.assertRaises(flow.FlowError):
            self.state()
        path = next((self.flow.runtime / 'runs').glob('*/state.json'))
        state = self.flow.load(path.parent.name)
        self.tasks.call = original
        self.flow.ensure_tasks(state)
        self.assertEqual(len(self.tasks.tasks), 5)
        self.assertEqual([s['task_id'] for s in state['stages']], ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'])

    def test_remote_task_created_before_lost_local_id_is_reconciled(self):
        state = self.state()
        state['stages'][0]['task_id'] = None
        self.flow.save(state)
        self.flow.ensure_tasks(state)
        self.assertEqual(state['stages'][0]['task_id'], 'task-1')
        self.assertEqual(len(self.tasks.tasks), 5)

    def test_duplicate_remote_stage_is_rejected(self):
        state = self.state()
        state['stages'][0]['task_id'] = None
        self.tasks.tasks['duplicate'] = {**self.tasks.tasks['task-1'], 'taskId': 'duplicate'}
        with self.assertRaises(flow.FlowError):
            self.flow.ensure_tasks(state)

    def test_read_only_host_phase_cannot_modify_source(self):
        state = self.state()
        (self.root / 'allowed/source.txt').write_text('modified')
        with self.assertRaises(flow.FlowError):
            self.flow.record(state, 'research', self.result())

    def test_changes_outside_profile_are_rejected(self):
        state = self.state()
        (self.root / 'unapproved.txt').write_text('change')
        with self.assertRaises(flow.FlowError):
            self.flow.assert_scope(state)

    def test_frozen_reference_changes_are_rejected(self):
        directory = self.root / 'migration/worker'
        directory.mkdir(parents=True)
        (directory / 'frozen.txt').write_text('frozen')
        (directory / 'baseline-manifest.json').write_text(json.dumps({'files': [{'path': 'frozen.txt', 'sha256': flow.digest(b'frozen')}]}))
        self.flow.definition['profiles']['tooling']['allowed_paths'].append('migration/')
        state = self.state()
        (directory / 'frozen.txt').write_text('modified')
        with self.assertRaises(flow.FlowError):
            self.flow.assert_scope(state)

    def test_test_stage_requires_actual_checks(self):
        state = self.state()
        with self.assertRaises(flow.FlowError):
            self.flow.checks(state)
        self.advance(state, 3)
        with self.assertRaises(flow.FlowError):
            self.flow.record(state, 'test', self.result())
        evidence = self.flow.checks(state)
        self.assertTrue(evidence['passed'])
        self.assertIn('real check process ran', (self.root / evidence['results'][0]['log']).read_text())
        self.flow.record(state, 'test', self.result())

    def test_failed_check_cannot_be_reported_as_pass(self):
        self.flow.definition['profiles']['tooling']['checks'][0]['argv'] = [sys.executable, '-c', 'raise SystemExit(7)']
        state = self.state()
        self.advance(state, 3)
        self.assertFalse(self.flow.checks(state)['passed'])
        with self.assertRaises(flow.FlowError):
            self.flow.record(state, 'test', self.result())

    def test_missing_check_command_is_a_failure(self):
        self.flow.definition['profiles']['tooling']['checks'][0]['argv'] = ['TEST-no-such-binary-123']
        state = self.state()
        self.advance(state, 3)
        evidence = self.flow.checks(state)
        self.assertFalse(evidence['passed'])
        self.assertEqual(evidence['results'][0]['exit_code'], 127)

    def test_source_change_makes_previous_check_evidence_stale(self):
        state = self.state()
        self.advance(state, 3)
        self.flow.checks(state)
        (self.root / 'allowed/source.txt').write_text('changed after checks')
        with self.assertRaises(flow.FlowError):
            self.flow.record(state, 'test', self.result())

    def test_test_log_tampering_is_rejected(self):
        state = self.state()
        self.advance(state, 3)
        evidence = self.flow.checks(state)
        (self.root / evidence['results'][0]['log']).write_text('pretend pass')
        with self.assertRaises(flow.FlowError):
            self.flow.record(state, 'test', self.result())

    def test_completed_check_logs_remain_verifiable_on_resume(self):
        state = self.state()
        self.advance(state, 4)
        (self.root / state['checks']['results'][0]['log']).write_text('changed after completion')
        with self.assertRaises(flow.FlowError):
            self.flow.load(state['run'])

    def test_backend_test_url_cannot_target_a_remote_host(self):
        self.flow.definition['profiles']['tooling']['checks'][0]['argv'].append('{test_url}')
        state = self.state()
        self.advance(state, 3)
        with patch.dict(os.environ, {'TAMIRAN_TEST_URL': 'https://customer.example'}):
            with self.assertRaises(flow.FlowError):
                self.flow.checks(state)

    def test_missing_prerequisites_block_model_execution(self):
        self.flow.definition['profiles']['tooling']['requires_paths'] = ['absent-test-prerequisite']
        state = self.state()
        with self.fake_codex(), self.assertRaises(flow.FlowError):
            self.flow.run(state)
        self.assertFalse((self.root / '.ruflo/argv.json').exists())

    def test_remote_completion_must_be_acknowledged(self):
        state = self.state()
        original = self.tasks.call

        def wrong_ack(tool, args):
            if tool == 'task_complete':
                return {'status': 'pending'}
            return original(tool, args)

        self.tasks.call = wrong_ack
        with self.assertRaises(flow.FlowError):
            self.flow.record(state, 'research', self.result())
        self.assertEqual(state['stages'][0]['status'], 'pending')

    def test_bad_result_schema_is_rejected(self):
        path = self.result()
        path.write_text(json.dumps({'outcome': 'pass', 'summary': 'missing fields'}))
        with self.assertRaises(flow.FlowError):
            flow.read_result(path)

    def test_manual_five_stage_flow_syncs_task_results(self):
        state = self.state()
        self.advance(state, 5)
        self.assertEqual(state['status'], 'completed')
        self.assertTrue(all(t['status'] == 'completed' for t in self.tasks.tasks.values()))
        self.assertIsNone(self.flow.current(state))
        self.assertIn('All five stages', self.flow.prompt(state))

    def test_automatic_runner_uses_codex_defaults_and_literal_prompt(self):
        state = self.flow.start('TEST literal `echo unsafe` $(echo unsafe); no shell evaluation', 'tooling')
        with self.fake_codex():
            self.flow.run(state, timeout=10)
        self.assertEqual(state['status'], 'completed')
        args = json.loads((self.root / '.ruflo/argv.json').read_text())
        for forbidden in ['--model', '-m', '--sandbox', '--dangerously-bypass-approvals-and-sandbox', '--ignore-user-config']:
            self.assertNotIn(forbidden, args)
        self.assertIn('$(echo unsafe)', (self.root / '.ruflo/prompt.txt').read_text())

    def test_model_process_failure_stops_before_later_stages(self):
        state = self.state()
        with self.fake_codex('fail'), self.assertRaises(flow.FlowError):
            self.flow.run(state, timeout=10)
        self.assertEqual(state['status'], 'blocked')
        self.assertEqual(state['stages'][1]['status'], 'pending')
        self.assertEqual(self.tasks.tasks['task-1']['status'], 'failed')

    def test_timeout_stops_process_and_records_blocker(self):
        state = self.state()
        with self.fake_codex('timeout'), self.assertRaises(subprocess.TimeoutExpired):
            self.flow.run(state, timeout=0.1)
        self.assertEqual(state['status'], 'blocked')

    def test_blocked_result_requires_explicit_retry(self):
        state = self.state()
        with self.fake_codex('blocked'):
            self.flow.run(state, timeout=10)
        self.assertEqual(state['status'], 'blocked')
        with self.fake_codex(), self.assertRaises(flow.FlowError):
            self.flow.run(state, timeout=10)
        with self.fake_codex():
            self.flow.run(state, timeout=10, retry=True)
        self.assertEqual(state['status'], 'completed')
        self.assertEqual(state['stages'][0]['attempts'], 2)

    def test_read_only_executor_edit_is_detected(self):
        state = self.state()
        with self.fake_codex('mutate'), self.assertRaises(flow.FlowError):
            self.flow.run(state, timeout=10)
        self.assertEqual(state['status'], 'blocked')

    def test_concurrent_workflow_command_is_refused(self):
        with flow.locked(self.flow):
            with self.assertRaises(flow.FlowError), flow.locked(self.flow):
                pass

    def test_cli_plan_and_doctor_do_not_start_models(self):
        for command in ['plan', 'doctor']:
            with contextlib.redirect_stdout(io.StringIO()) as stream:
                self.assertEqual(flow.main(['--root', str(self.root), command]), 0)
            self.assertTrue(json.loads(stream.getvalue()))
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(flow.main(['--root', str(self.root), 'start']), 1)


# Keep the integration fixture independent of inherited unittest discovery.
class RealRufloTest(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('TAMIRAN_RUFLO_INTEGRATION') == '1' and shutil.which('ruflo'), 'opt-in real Ruflo integration')
    def test_task_persistence_with_real_mcp_and_host_evidence(self):
        fixture = FlowTests('test_start_persists_five_real_task_ids_and_order')
        fixture.setUp()
        try:
            path = fixture.root / '.ruflo/mcp.log'
            with flow.Ruflo(fixture.root, path) as client:
                runner = flow.Flow(fixture.root, client)
                state = runner.start('TEST-TAMIRAN real MCP lifecycle; no model', 'tooling')
                self.assertEqual(len({s['task_id'] for s in state['stages']}), 5)
            # Restart the MCP process: IDs and tasks must survive the session.
            with flow.Ruflo(fixture.root, path) as client:
                runner = flow.Flow(fixture.root, client)
                state = runner.load(state['run'])
                for _ in range(5):
                    stage = runner.current(state)
                    if stage['id'] == 'test':
                        self.assertTrue(runner.checks(state)['passed'])
                    runner.record(state, stage['id'], fixture.result())
                for stage in state['stages']:
                    self.assertEqual(client.call('task_status', {'taskId': stage['task_id']})['status'], 'completed')
                self.assertEqual(state['status'], 'completed')
        finally:
            fixture.doCleanups()


if __name__ == '__main__':
    unittest.main()
