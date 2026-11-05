#!/usr/bin/env python3
"""Five-stage Codex workflow, coordinated through real Ruflo task tools.

No vendor patches or provider/model/permission overrides. Runtime state, results
and logs live in ignored .ruflo/tamiran/. `start` never starts an LLM; `run` does.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import signal
import subprocess
import sys
import time
import tomllib
import urllib.parse
import uuid


class FlowError(RuntimeError):
    pass


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temporary.open('x', encoding='utf-8') as handle:
            os.chmod(temporary, 0o600)
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def contained(root, path):
    resolved = (root / path).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise FlowError('Path escapes the project: ' + str(path))
    return resolved


def stop_process(process):
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
    if process.stdin and not process.stdin.closed:
        try:
            process.stdin.close()
        except OSError:
            pass


class Ruflo:
    """Small newline-delimited JSON-RPC client; prompts never enter argv."""
    def __init__(self, root, log):
        binary = shutil.which('ruflo')
        if not binary:
            raise FlowError('Install Ruflo first: npm install -g ruflo@3.71.4')
        contained(root, '.claude-flow').mkdir(mode=0o700, exist_ok=True)
        log.parent.mkdir(parents=True, exist_ok=True)
        self.stderr = log.open('ab')
        self.process = subprocess.Popen([binary, 'mcp', 'start'], cwd=root, stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=self.stderr, start_new_session=True)
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout, selectors.EVENT_READ)
        self.buffer = b''
        self.sequence = 0
        try:
            self.rpc('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {},
                                   'clientInfo': {'name': 'tamiran-flow', 'version': '1'}})
            self.send({'jsonrpc': '2.0', 'method': 'notifications/initialized'})
        except BaseException:
            self.close()
            raise

    def send(self, data):
        self.process.stdin.write((json.dumps(data) + '\n').encode())
        self.process.stdin.flush()

    def rpc(self, method, params):
        self.sequence += 1
        identifier = self.sequence
        self.send({'jsonrpc': '2.0', 'id': identifier, 'method': method, 'params': params})
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            while b'\n' in self.buffer:
                raw, self.buffer = self.buffer.split(b'\n', 1)
                if not raw.strip():
                    continue
                try:
                    message = json.loads(raw)
                except (ValueError, UnicodeError) as error:
                    raise FlowError('Ruflo emitted non-JSON protocol output') from error
                if message.get('id') == identifier:
                    if 'error' in message:
                        raise FlowError('Ruflo RPC failed: ' + str(message['error']))
                    return message['result']
            if self.process.poll() is not None:
                raise FlowError('Ruflo MCP exited unexpectedly')
            if self.selector.select(0.5):
                chunk = os.read(self.process.stdout.fileno(), 65536)
                if not chunk:
                    raise FlowError('Ruflo closed its protocol stream')
                self.buffer += chunk
        raise FlowError('Ruflo RPC timed out')

    def call(self, name, arguments):
        response = self.rpc('tools/call', {'name': name, 'arguments': arguments})
        if response.get('isError'):
            raise FlowError('Ruflo tool failed: ' + name)
        text = next((x['text'] for x in response.get('content', []) if x.get('type') == 'text'), None)
        try:
            data = json.loads(text)
        except (ValueError, TypeError) as error:
            raise FlowError('Ruflo tool returned invalid data: ' + name) from error
        if not isinstance(data, dict) or data.get('success') is False or data.get('error'):
            raise FlowError('Ruflo rejected ' + name + ': ' + str(data.get('error') if isinstance(data, dict) else data))
        return data

    def close(self):
        try:
            self.process.stdin.close()
            self.process.wait(timeout=2)
        except (OSError, subprocess.TimeoutExpired):
            stop_process(self.process)
        self.process.stdout.close()
        self.selector.close()
        self.stderr.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


def snapshot(root):
    result = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
                            cwd=root, check=True, capture_output=True)
    files = {}
    for raw in set(result.stdout.split(b'\0')) - {b''}:
        name = os.fsdecode(raw)
        if name.startswith(('.ruflo/', '.claude-flow/')):
            continue
        path = root / name
        if path.is_symlink():
            files[name] = 'symlink:' + os.readlink(path)
        elif path.is_file():
            files[name] = digest(path.read_bytes())
        else:
            files[name] = 'deleted'
    return files


def fingerprint(files):
    return digest(json.dumps(files, sort_keys=True).encode())


def changed(before, after):
    return {name for name in before.keys() | after.keys() if before.get(name) != after.get(name)}


def read_result(path):
    data = json.loads(path.read_text())
    expected = {'outcome', 'summary', 'findings', 'tests', 'risks'}
    if not isinstance(data, dict) or set(data) != expected:
        raise FlowError('Result must match workflows/result.schema.json')
    if data['outcome'] not in ['pass', 'blocked'] or not isinstance(data['summary'], str) or not data['summary'].strip():
        raise FlowError('Result needs a nonempty summary and pass/blocked outcome')
    for key in ['findings', 'tests', 'risks']:
        if not isinstance(data[key], list) or not all(isinstance(x, str) for x in data[key]):
            raise FlowError('Invalid result field: ' + key)
    return data


class Flow:
    def __init__(self, root, client=None):
        self.root = root.resolve()
        self.definition_path = self.root / 'workflows/tamiran.json'
        raw = self.definition_path.read_bytes()
        self.definition = json.loads(raw)
        self.definition_hash = digest(raw)
        ids = [s['id'] for s in self.definition['stages']]
        if ids != ['research', 'design', 'implement', 'test', 'review']:
            raise FlowError('Workflow must define the five ordered stages')
        self.runtime = contained(self.root, '.ruflo/tamiran')
        self.client = client

    def path(self, run):
        if not re.fullmatch(r'[a-f0-9]{16}', run):
            raise FlowError('Invalid run ID')
        return contained(self.root, f'.ruflo/tamiran/runs/{run}/state.json')

    def load(self, run):
        state = json.loads(self.path(run).read_text())
        if state['definition_hash'] != self.definition_hash:
            raise FlowError('Workflow definition changed; start a new run')
        for stage in state['stages']:
            if stage['status'] == 'completed':
                artifact = contained(self.root, stage['artifact'])
                if not artifact.is_file() or digest(artifact.read_bytes()) != stage['artifact_sha256']:
                    raise FlowError('Completed evidence changed: ' + stage['id'])
                if stage['id'] == 'test':
                    for check in state.get('checks', {}).get('results', []):
                        if digest(contained(self.root, check['log']).read_bytes()) != check['log_sha256']:
                            raise FlowError('Completed test log changed: ' + check['name'])
        return state

    def save(self, state):
        state['updated_at'] = now()
        atomic_json(self.path(state['run']), state)

    def profile(self, name):
        try:
            return self.definition['profiles'][name]
        except KeyError as error:
            raise FlowError('Unknown check profile: ' + name) from error

    def prerequisites(self, profile):
        p = self.profile(profile)
        return {'commands': [cmd for cmd in p['requires'] if not shutil.which(cmd)],
                'paths': [path for path in p.get('requires_paths', []) if not (self.root / path).exists()],
                'environment_names': [name for name in p.get('requires_env', []) if not os.environ.get(name)]}

    def call(self, name, arguments):
        return self.client.call(name, arguments)

    def start(self, task, profile):
        if not task.strip() or len(task) > 4000:
            raise FlowError('Task must contain 1–4000 characters')
        self.profile(profile)
        run = uuid.uuid4().hex[:16]
        self.runtime.mkdir(mode=0o700, parents=True, exist_ok=True)
        initial = snapshot(self.root)
        state = {'run': run, 'task': task, 'profile': profile, 'status': 'ready', 'created_at': now(),
                 'definition_hash': self.definition_hash, 'initial_snapshot': initial,
                 'stages': [{**s, 'status': 'pending', 'task_id': None, 'attempts': 0} for s in self.definition['stages']]}
        self.save(state)
        # Save each returned ID immediately. Interrupted setup is recoverable by
        # `next`/`run`, which only creates still-missing tasks.
        self.ensure_tasks(state)
        return state

    def ensure_tasks(self, state):
        existing = None
        for stage in state['stages']:
            if not stage['task_id']:
                if existing is None:
                    existing = self.call('task_list', {'limit': 10000}).get('tasks', [])
                matches = [task for task in existing if all(tag in task.get('tags', [])
                           for tag in ['tamiran-flow', state['run'], stage['id']])]
                if len(matches) > 1:
                    raise FlowError('Multiple Ruflo tasks match stage ' + stage['id'])
                if matches:
                    stage['task_id'] = matches[0]['taskId']
                else:
                    result = self.call('task_create', {'type': 'feature', 'description': f"Tamiran {state['run']} / {stage['id']}: {state['task']}",
                                                      'tags': ['tamiran-flow', state['run'], stage['id']]})
                    stage['task_id'] = result['taskId']
                self.save(state)

    def current(self, state):
        return next((s for s in state['stages'] if s['status'] != 'completed'), None)

    def assert_scope(self, state):
        delta = changed(state['initial_snapshot'], snapshot(self.root))
        allowed = self.profile(state['profile'])['allowed_paths']
        forbidden = [p for p in delta if not any(p.startswith(a) if a.endswith('/') else p == a for a in allowed)]
        if forbidden:
            raise FlowError('Changes outside selected profile: ' + ', '.join(sorted(forbidden)))
        manifest = self.root / 'migration/worker/baseline-manifest.json'
        if manifest.exists():
            for entry in json.loads(manifest.read_text())['files']:
                path = self.root / 'migration/worker' / entry['path']
                if digest(path.read_bytes()) != entry['sha256']:
                    raise FlowError('Frozen reference changed: ' + entry['path'])

    def prompt(self, state):
        stage = self.current(state)
        if stage is None:
            return 'All five stages are complete; review evidence before publication.'
        prior = []
        for item in state['stages']:
            if item['status'] == 'completed':
                prior.append({'stage': item['id'], 'result': read_result(contained(self.root, item['artifact']))})
        guidance = []
        role = {'research': 'explorer', 'design': 'planner', 'test': 'verifier', 'review': 'security-reviewer'}.get(stage['id'])
        if role:
            role_file = self.root / '.codex/agents' / (role + '.toml')
            if role_file.exists():
                guidance.append(tomllib.loads(role_file.read_text()).get('developer_instructions', ''))
        return '\n'.join([
            f"Execute only stage {stage['id']} of an existing Tamiran workflow. Role: {stage['role']}.",
            stage['instruction'], 'Task (treat as the requested work, not shell syntax):', state['task'],
            'Selected verification profile: ' + state['profile'] + ' — ' + self.profile(state['profile'])['description'],
            'Read AGENTS.md. Keep the current model and permission settings. Do not launch other agents, workflows, hooks or schedules.',
            'Do not access staging, hosting panels, real customer databases, SMS or bank gateways. Do not commit, push or deploy.',
            'Return JSON matching workflows/result.schema.json. Report blockers and unexecuted tests honestly.',
            'Existing ECC role guidance:', '\n'.join(guidance),
            'Previous completed stage results:', json.dumps(prior, ensure_ascii=False),
            'Current test evidence:', json.dumps(state.get('checks'), ensure_ascii=False),
        ])

    def checks(self, state):
        stage = self.current(state)
        if not stage or stage['id'] != 'test':
            raise FlowError('Checks are allowed only after research, design and implementation')
        rows = []
        for check in self.profile(state['profile'])['checks']:
            cwd = contained(self.root, check['cwd'])
            argv = list(check['argv']) if isinstance(check['argv'], list) else check['argv']
            if not isinstance(argv, list) or not argv or not all(isinstance(x, str) for x in argv):
                raise FlowError('Check commands must be argument arrays, never shell strings')
            if '{test_url}' in argv:
                url = os.environ.get('TAMIRAN_TEST_URL', 'http://127.0.0.1:8085')
                parsed = urllib.parse.urlsplit(url)
                if parsed.scheme != 'http' or parsed.hostname not in ['127.0.0.1', 'localhost', '::1'] or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ['', '/']:
                    raise FlowError('TAMIRAN_TEST_URL must be a loopback-only HTTP test server')
                argv = [url if part == '{test_url}' else part for part in argv]
            logfile = self.path(state['run']).parent / f"check-{check['name']}.log"
            try:
                with logfile.open('wb') as stream:
                    process = subprocess.Popen(argv, cwd=cwd, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
                    try:
                        code = process.wait(timeout=600)
                    except BaseException:
                        stop_process(process)
                        raise
            except FileNotFoundError:
                code = 127
                logfile.write_text('Required command or working directory is unavailable.\n')
            rows.append({'name': check['name'], 'argv': argv, 'cwd': check['cwd'], 'exit_code': code,
                         'log': str(logfile.relative_to(self.root)), 'log_sha256': digest(logfile.read_bytes())})
            if code != 0:
                break
        self.assert_scope(state)
        state['checks'] = {'passed': all(x['exit_code'] == 0 for x in rows) and len(rows) == len(self.profile(state['profile'])['checks']),
                           'results': rows, 'snapshot': fingerprint(snapshot(self.root)), 'time': now()}
        self.save(state)
        return state['checks']

    def record(self, state, stage_id, result_path):
        stage = self.current(state)
        if not stage or stage['id'] != stage_id:
            raise FlowError('Stages cannot be skipped or completed twice')
        result = read_result(result_path)
        self.assert_scope(state)
        if result['outcome'] == 'pass' and stage_id in ['research', 'design', 'review']:
            index = state['stages'].index(stage)
            before = state['initial_snapshot'] if index == 0 else state['stages'][index - 1]['snapshot_after']
            if snapshot(self.root) != before:
                raise FlowError('A read-only phase changed source; inspect and resolve the change')
        if result['outcome'] == 'pass' and stage_id == 'test':
            checks = state.get('checks', {})
            if not checks.get('passed') or checks.get('snapshot') != fingerprint(snapshot(self.root)):
                raise FlowError('Passing, current check evidence is required before completing test')
            for check in checks['results']:
                if digest(contained(self.root, check['log']).read_bytes()) != check['log_sha256']:
                    raise FlowError('Test log changed: ' + check['name'])
        artifact = self.path(state['run']).parent / f"{stage_id}-{stage['attempts'] + 1}.json"
        atomic_json(artifact, result)
        completed = result['outcome'] == 'pass'
        if completed:
            acknowledgement = self.call('task_complete', {'taskId': stage['task_id'], 'result': {'summary': result['summary'],
                                      'evidence': str(artifact.relative_to(self.root)), 'sha256': digest(artifact.read_bytes()), 'executor': 'codex-host'}})
            if acknowledgement.get('status') != 'completed':
                raise FlowError('Ruflo did not acknowledge task completion')
        else:
            self.call('task_update', {'taskId': stage['task_id'], 'status': 'failed', 'result': {'summary': result['summary']}})
        stage.update(status='completed' if completed else 'blocked', artifact=str(artifact.relative_to(self.root)),
                     artifact_sha256=digest(artifact.read_bytes()), attempts=stage['attempts'] + 1,
                     snapshot_after=snapshot(self.root))
        state['status'] = 'completed' if all(s['status'] == 'completed' for s in state['stages']) else 'ready' if completed else 'blocked'
        self.save(state)

    def run(self, state, timeout=900, retry=False):
        missing = self.prerequisites(state['profile'])
        if any(missing.values()):
            raise FlowError('Missing verification prerequisites: ' + json.dumps(missing))
        if timeout <= 0:
            raise FlowError('Timeout must be positive')
        self.ensure_tasks(state)
        binary = shutil.which('codex')
        if not binary:
            raise FlowError('Codex CLI is required; use next/record from a Codex host session instead')
        while (stage := self.current(state)) is not None:
            if stage['status'] == 'blocked' and not retry:
                raise FlowError('Run is blocked; inspect its evidence and resume with --retry')
            self.assert_scope(state)
            before = snapshot(self.root)
            self.call('task_update', {'taskId': stage['task_id'], 'status': 'in_progress', 'progress': 0})
            stage['status'] = 'in_progress'
            self.save(state)
            directory = self.path(state['run']).parent
            output = directory / f"codex-{stage['id']}-{stage['attempts'] + 1}.json"
            log = directory / f"codex-{stage['id']}-{stage['attempts'] + 1}.log"
            argv = [binary, 'exec', '--cd', str(self.root), '--ephemeral', '--output-schema',
                    str(self.root / 'workflows/result.schema.json'), '--output-last-message', str(output), '-']
            try:
                with log.open('wb') as stream:
                    process = subprocess.Popen(argv, cwd=self.root, stdin=subprocess.PIPE, stdout=stream,
                                               stderr=subprocess.STDOUT, start_new_session=True)
                    try:
                        process.communicate(self.prompt(state).encode(), timeout=timeout)
                    except BaseException:
                        stop_process(process)
                        raise
                if process.returncode != 0:
                    raise FlowError('Codex failed; inspect ' + str(log.relative_to(self.root)))
                if stage['id'] != 'implement' and snapshot(self.root) != before:
                    raise FlowError('A read-only phase modified source; inspect changes before retrying')
                if stage['id'] == 'test' and not self.checks(state)['passed']:
                    raise FlowError('Required checks failed')
                self.record(state, stage['id'], output)
                if stage['status'] == 'blocked':
                    break
            except BaseException as error:
                blocked = {'outcome': 'blocked', 'summary': str(error) or type(error).__name__,
                           'findings': [], 'tests': [], 'risks': ['Run stopped; inspect source and local execution log.']}
                failure = directory / 'blocked-result.json'
                atomic_json(failure, blocked)
                # Preserve the failure even if an MCP outage prevents syncing it.
                stage['status'] = 'blocked'
                state['status'] = 'blocked'
                self.save(state)
                try:
                    self.record(state, stage['id'], failure)
                except Exception:
                    pass
                raise
        return state


@contextmanager
def locked(flow):
    flow.runtime.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (flow.runtime / 'runner.lock').open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise FlowError('Another workflow command is running in this project') from error
        yield


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('plan')
    commands.add_parser('doctor')
    commands.add_parser('php-lint')
    for command in ['start', 'run']:
        p = commands.add_parser(command)
        p.add_argument('--task')
        p.add_argument('--profile', default='tooling')
        if command == 'run':
            p.add_argument('--run')
            p.add_argument('--retry', action='store_true')
            p.add_argument('--timeout', type=int, default=900)
    for command in ['next', 'status', 'check', 'record']:
        p = commands.add_parser(command)
        p.add_argument('--run', required=True)
        if command == 'record':
            p.add_argument('--stage', required=True)
            p.add_argument('--result', type=Path, required=True)
    a = parser.parse_args(argv)
    try:
        flow = Flow(a.root)
        if a.command == 'php-lint':
            php = shutil.which('php')
            if not php:
                raise FlowError('PHP CLI is required for the backend-local profile')
            files = sorted((flow.root / 'hosting/public_html').rglob('*.php'))
            files += sorted(p for p in (flow.root / 'hosting/private').glob('*.php') if p.name != 'config.php')
            if not files:
                raise FlowError('No PHP source files found')
            for path in files:
                subprocess.run([php, '-l', str(path)], check=True)
            return 0
        if a.command == 'plan':
            print(json.dumps(flow.definition, ensure_ascii=False, indent=2))
            return 0
        if a.command == 'doctor':
            result = {'ruflo': bool(shutil.which('ruflo')), 'codex': bool(shutil.which('codex')),
                      'profiles': {name: {'commands': {cmd: bool(shutil.which(cmd)) for cmd in p['requires']},
                                         'paths': {path: (flow.root / path).exists() for path in p.get('requires_paths', [])},
                                         'environment_names': {key: bool(os.environ.get(key)) for key in p.get('requires_env', [])}}
                                   for name, p in flow.definition['profiles'].items()}}
            print(json.dumps(result, indent=2))
            return int(not result['ruflo'])
        if a.command in ['start', 'run'] and not a.task and not getattr(a, 'run', None):
            raise FlowError('--task is required for a new run')
        with locked(flow):
            if a.command in ['next', 'status']:
                state = flow.load(a.run)
                if a.command == 'status':
                    last = next((s for s in reversed(state['stages']) if s['status'] == 'completed'), None)
                    state['worktree_matches_last_completed_stage'] = not last or snapshot(flow.root) == last['snapshot_after']
                print(flow.prompt(state) if a.command == 'next' else json.dumps(state, ensure_ascii=False, indent=2))
                return 0
            with Ruflo(flow.root, flow.runtime / 'mcp.log') as client:
                flow.client = client
                if a.command in ['start', 'run']:
                    if a.command == 'run' and a.run:
                        state = flow.load(a.run)
                    else:
                        if not a.task:
                            raise FlowError('--task is required for a new run')
                        state = flow.start(a.task, a.profile)
                    if a.command == 'run':
                        flow.run(state, a.timeout, a.retry)
                else:
                    state = flow.load(a.run)
                    flow.ensure_tasks(state)
                    if a.command == 'check':
                        checks = flow.checks(state)
                        print(json.dumps(checks, ensure_ascii=False, indent=2))
                        return int(not checks['passed'])
                    flow.record(state, a.stage, a.result)
                print(json.dumps({'run': state['run'], 'status': state['status'],
                                  'stages': [{'id': s['id'], 'status': s['status'], 'ruflo_task': s['task_id']} for s in state['stages']]}, indent=2))
                return int(state['status'] == 'blocked')
    except (FlowError, OSError, ValueError, subprocess.SubprocessError) as error:
        print('Workflow error: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
