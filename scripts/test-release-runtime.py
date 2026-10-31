#!/usr/bin/env python3
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('runtime', Path(__file__).with_name('verify-release-runtime.py'))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)
IMAGE = 'alive.azurecr.io/alive/hhc-web@sha256:' + 'a' * 64
APP = {'latest': 'hhc-web--candidate', 'ready': 'hhc-web--candidate', 'traffic': None, 'ingress': False}
REVISION = {'active': True, 'health': 'Healthy', 'provisioning': 'Provisioned', 'running': 'Running', 'images': [IMAGE]}


class RuntimeVerification(unittest.TestCase):
    def observe(self, app=None, revision=None, expected='hhc-web--candidate'):
        with patch.dict(os.environ, RESOURCE_GROUP='fixture'), patch.object(runtime, 'azure', side_effect=[app or APP, revision or REVISION]):
            return runtime.observe('hhc-web', expected, IMAGE)[0]

    def test_rollback_steps_require_explicit_negative_evidence(self):
        workflow = Path('.github/workflows/release.yml').read_text()
        self.assertNotIn('containerapp exec', workflow)
        for block in workflow.split('      - name: '):
            if block.startswith(('Roll back failed', 'Restore previous watermark', 'Disable and restore failed extractor', 'Verify rolled back runtime', 'Verify recovered runtime')):
                self.assertIn("steps.recovery.outputs.required == 'true'", block)

    def test_exact_healthy_revision_with_or_without_ingress(self):
        self.assertEqual(self.observe(), 0)
        for rule in [{'revisionName': APP['latest'], 'weight': 100}, {'latestRevision': True, 'weight': 100}]:
            self.assertEqual(self.observe(app={**APP, 'ingress': True, 'traffic': [rule]}), 0)

    def test_stale_identity_or_incomplete_traffic_is_unverified(self):
        for state in [{**APP, 'ready': 'old'}, {**APP, 'latest': 'old'}, {**APP, 'ingress': True, 'traffic': []},
                      {**APP, 'ingress': True, 'traffic': [{'revisionName': 'old', 'weight': 100}]}]:
            self.assertEqual(self.observe(app=state), 20)
        self.assertEqual(self.observe(revision={**REVISION, 'images': [IMAGE + 'b']}), 20)
        self.assertEqual(self.observe(revision={**REVISION, 'active': False}), 20)

    def test_known_application_negative(self):
        self.assertEqual(self.observe(revision={**REVISION, 'health': 'Unhealthy'}), 10)
        self.assertEqual(self.observe(revision={**REVISION, 'provisioning': 'Failed'}), 10)
        self.assertEqual(self.observe(revision={**REVISION, 'health': 'Unknown'}), 20)

    def test_recovery_requires_observed_failure_not_failed_request(self):
        with patch.dict(os.environ, {'FAILED_DEPLOYMENTS': '["deployment"]', 'RESOURCE_GROUP': 'fixture'}):
            with patch.object(runtime, 'azure', return_value='Failed'):
                self.assertEqual(runtime.recovery(), 10)
            with patch.object(runtime, 'azure', side_effect=ValueError('ARM429')):
                with self.assertRaises(ValueError):
                    runtime.recovery()

    def test_channel_failure_never_selects_rollback(self):
        for error in [ValueError('ARM429'), ValueError('ARM403'), KeyError('missing'), TypeError('malformed')]:
            with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'GITHUB_OUTPUT': folder + '/output'}), patch.object(runtime.sys, 'argv', ['runtime', 'recovery']), patch.object(runtime, 'recovery', side_effect=error):
                self.assertEqual(runtime.main(), 0)
                self.assertEqual(Path(folder, 'output').read_text(), 'required=false\n')

    def test_only_negative_selects_rollback(self):
        for result, required in [(0, 'false'), (10, 'true'), (20, 'false')]:
            with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'GITHUB_OUTPUT': folder + '/output'}), patch.object(runtime.sys, 'argv', ['runtime', 'recovery']), patch.object(runtime, 'recovery', return_value=result):
                self.assertEqual(runtime.main(), 0)
                self.assertEqual(Path(folder, 'output').read_text(), 'required=' + required + '\n')

    def test_verification_pins_candidate_and_bounds_pending_state(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'GITHUB_ENV': folder + '/env', 'APP_NAME': 'hhc-web', 'IMAGE_REF': IMAGE}), patch.object(runtime.sys, 'argv', ['runtime']), patch.object(runtime, 'observe', return_value=(0, APP['latest'])):
            self.assertEqual(runtime.main(), 0)
            self.assertEqual(Path(folder, 'env').read_text(), 'CANDIDATE_REVISION=' + APP['latest'] + '\n')
        with patch.dict(os.environ, {'APP_NAME': 'hhc-web', 'IMAGE_REF': IMAGE}), patch.object(runtime.sys, 'argv', ['runtime']), patch.object(runtime, 'observe', return_value=(20, APP['latest'])) as probe, patch.object(runtime.time, 'sleep') as sleep:
            self.assertEqual(runtime.main(), 20)
            self.assertEqual(probe.call_count, 60)
            self.assertEqual(sleep.call_count, 59)


class PublicVerification(unittest.TestCase):
    def test_public_transport_status_and_complete_html(self):
        for code, status, body, expected in [(0, '200', '<html>complete</html>', 0), (6, '000', '', 20), (0, '503', '<html>edge</html>', 20), (0, '200', '<html>truncated', 20)]:
            with tempfile.TemporaryDirectory() as folder:
                tool = Path(folder, 'curl')
                tool.write_text('#!/bin/sh\nwhile [ "$1" != --output ]; do shift; done\nprintf "%s" "$BODY" >"$2"\nprintf "%s" "$STATUS"\nexit "$CODE"\n')
                tool.chmod(0o755)
                env = {**os.environ, 'PATH': folder + os.pathsep + os.environ['PATH'], 'CODE': str(code), 'STATUS': status, 'BODY': body}
                result = runtime.subprocess.run(['bash', 'scripts/verify-public-release.sh'], env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, expected, result.stderr)


if __name__ == '__main__':
    unittest.main()
