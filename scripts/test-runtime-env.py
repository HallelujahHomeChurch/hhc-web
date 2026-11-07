import test_no_cloud  # Block real Azure in every child process.
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('runtime_env', Path(__file__).with_name('runtime-env.py'))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


def manifest(env):
    return {'resources': {'hhc-web': env}}


class RuntimeEnvironment(unittest.TestCase):
    def test_schema_rejects_build_variables_and_ambiguous_values(self):
        for env in ({'NEXT_PUBLIC_FLAG': {'value': 'true'}}, {'VITE_FLAG': {'value': 'true'}}, {'X': {'value': 'secretref:hidden'}}, {'X': {'value': 'a\nb'}}, {'X': 'plain'}, {'X': {'value': 'a', 'secretRef': 'b'}}):
            with self.subTest(env=env), self.assertRaises(ValueError):
                runtime.validate(manifest(env))
        self.assertEqual(runtime.validate(manifest({'X': None})), {'X': None})

    def test_same_image_merge_and_explicit_remove(self):
        template = {'containers':[{'name':'hhc-web','image':'alive.azurecr.io/alive/hhc-web@sha256:'+'a'*64,'resources':{'cpu':0.5},'env':[{'name':'UNOWNED','value':'keep'},{'name':'OLD','value':'remove'}]}],'scale':{'minReplicas':1}}
        state = {'id':'/subscriptions/fixture/resourceGroups/alive/providers/Microsoft.App/containerApps/hhc-web','properties':{'latestRevisionName':'hhc-web--ready','latestReadyRevisionName':'hhc-web--ready','configuration':{'activeRevisionsMode':'Single','secrets':[{'name':'existing'}]},'template':template}}
        env = {'LIMIT': {'value': '2'}, 'TOKEN': {'secretRef': 'existing'}, 'OLD': None}
        with patch.dict(os.environ,{'GITHUB_RUN_ID':'1','GITHUB_RUN_ATTEMPT':'1'}), patch.object(runtime, 'run', return_value=json.dumps(state)), patch.object(runtime.subprocess,'run',return_value=subprocess.CompletedProcess([],0)) as command, patch.object(runtime,'wait_revision'):
            runtime.deploy(runtime.validate(manifest(env)))
        payload=json.loads(command.call_args.kwargs['input'])['properties']['template']
        self.assertEqual(payload['containers'][0]['image'],template['containers'][0]['image'])
        self.assertEqual(payload['containers'][0]['resources'],template['containers'][0]['resources'])
        self.assertEqual(payload['scale'],template['scale'])
        self.assertEqual(payload['containers'][0]['env'],[{'name':'UNOWNED','value':'keep'},{'name':'LIMIT','value':'2'},{'name':'TOKEN','secretRef':'existing'}])
        self.assertIn('@/dev/stdin',command.call_args.args[0])
        for field,value in [('latestRevisionName','pending'),('configuration',{'activeRevisionsMode':'Single','secrets':[]})]:
            broken=copy.deepcopy(state);broken['properties'][field]=value
            with patch.object(runtime, 'run', return_value=json.dumps(broken)), self.assertRaises(ValueError):
                runtime.deploy(env)

    def test_release_identity_is_reserved(self):
        for value in ({'value':'different-release'}, {'secretRef':'existing'}, None):
            with self.assertRaises(ValueError):
                runtime.validate(manifest({'RELEASE':value}))

    def test_refresh_latest_settings_without_refreshing_code(self):
        root=Path(__file__).resolve().parents[1]
        spec=importlib.util.spec_from_file_location('refresh',root/'scripts/refresh-runtime-env.py')
        refresh=importlib.util.module_from_spec(spec);spec.loader.exec_module(refresh)
        before=json.loads((root/'infra/runtime-env.json').read_text())
        latest=json.loads(json.dumps(before));target=next(iter(latest['resources']))
        latest['resources'][target]['NEW_SETTING']={'value':'new'}
        with tempfile.TemporaryDirectory() as directory:
            source=Path(directory)/'runtime-env.json';source.write_text(json.dumps(before))
            with patch.object(refresh,'SOURCE',source),patch.dict(os.environ,{'GITHUB_REF':'refs/heads/main','GITHUB_REPOSITORY':'fixture'}),patch.object(refresh.subprocess,'check_output',return_value=json.dumps(latest)):
                refresh.refresh()
            self.assertEqual(json.loads(source.read_text()),latest)
        workflow=root/'.github/workflows'/('release-production.yml' if root.name=='audit-log' else 'release.yml')
        text=workflow.read_text()
        for job in (['deploy','deploy-sandbox'] if root.name=='donation-api' else ['deploy']):
            part=text.split('  '+job+':\n',1)[1].split('\n  ',1)[0]
            # Job body indentation is greater than two spaces.
            self.assertIn('scripts/refresh-runtime-env.py',text.split('  '+job+':\n',1)[1])

    def test_freshness_compares_manifest_not_unrelated_main_commit(self):
        root=Path(__file__).resolve().parents[1]
        workflow=root/'.github/workflows'/('release-production.yml' if root.name=='audit-log' else 'release.yml')
        text=workflow.read_text()
        start=text.index('          current=$(gh api -H')
        script=text[start:text.index('          python3 scripts/runtime',start)]+'echo APPLY\n'
        desired=(root/'infra/runtime-env.json').read_text()
        with tempfile.TemporaryDirectory() as directory:
            gh=Path(directory)/'gh';gh.write_text('#!/bin/sh\n[ "$GH_FAILURE" = false ] || exit 3\nprintf "%s" "$LATEST"\n');gh.chmod(0o755)
            for latest,failure,applied in [(desired,'false',True),(desired+' ','false',False),(desired,'true',False)]:
                result=subprocess.run(['bash','-e','-o','pipefail','-c',script],cwd=root,env={**os.environ,'PATH':directory+os.pathsep+os.environ['PATH'],'GITHUB_REPOSITORY':'fixture','GITHUB_SHA':'different-docs-only-commit','LATEST':latest,'GH_FAILURE':failure},text=True,capture_output=True)
                self.assertEqual('APPLY' in result.stdout,applied)
                if failure=='true':self.assertNotEqual(result.returncode,0)

    def test_real_child_process_is_blocked(self):
        with self.assertRaises(subprocess.CalledProcessError):
            runtime.run('az','containerapp','update','--name','fixture')
        self.assertEqual(list(Path(os.environ['AZURE_CONFIG_DIR']).iterdir()),[])

    def test_diff_routes_only_regular_config_modifications(self):
        previous = os.getcwd()
        with tempfile.TemporaryDirectory() as folder:
            os.chdir(folder)
            try:
                def git(*args):
                    return subprocess.check_output(['git', *args], stderr=subprocess.DEVNULL, text=True).strip()
                git('init'); git('config', 'user.email', 'test@example.test'); git('config', 'user.name', 'Test')
                Path('infra').mkdir()
                path = Path(runtime.MANIFEST)
                path.write_text(json.dumps(manifest({})))
                git('add', '.'); git('commit', '-qm', 'base'); base = git('rev-parse', 'HEAD')
                path.write_text(json.dumps(manifest({'X': {'value': '1'}})))
                git('add', '.'); git('commit', '-qm', 'config'); head = git('rev-parse', 'HEAD')
                self.assertTrue(runtime.config_only('push', base, head))
                self.assertTrue(runtime.config_only('pull_request', base, head))
                self.assertFalse(runtime.config_only('workflow_dispatch', base, head))
                self.assertFalse(runtime.config_only('push', '0' * 40, head))
                for other in ('README.md','scripts/test-fixture.py','.github/workflows/example.yml'):
                    extra=Path(other);extra.parent.mkdir(parents=True,exist_ok=True);extra.write_text('mixed')
                    git('add','.');git('commit','-qm','mixed')
                    self.assertFalse(runtime.config_only('push',base,git('rev-parse','HEAD')))
                Path('source.ts').write_text('code')
                git('add', '.'); git('commit', '-qm', 'mixed')
                self.assertFalse(runtime.config_only('push', base, git('rev-parse', 'HEAD')))
                base = git('rev-parse', 'HEAD')
                path.write_text(json.dumps(manifest({})))
                git('add', '.'); git('commit', '-qm', 'removed ownership')
                self.assertFalse(runtime.config_only('push', base, git('rev-parse', 'HEAD')))
                base = git('rev-parse', 'HEAD')
                path.chmod(0o755); git('add', '.'); git('commit', '-qm', 'executable')
                self.assertFalse(runtime.config_only('push', base, git('rev-parse', 'HEAD')))
            finally:
                os.chdir(previous)

    def test_workflow_fast_path_has_no_test_build_or_smoke(self):
        workflow = Path('.github/workflows/release.yml').read_text()
        config = workflow.split('  configure_runtime:', 1)[1]
        self.assertIn('runtime-env.py deploy', config)
        for forbidden in ('pnpm', 'docker', 'smoke', 'test-', 'migration', 'bicep'):
            self.assertNotIn(forbidden, config)
        self.assertIn("needs.agent_docs.outputs.config_only != 'true'", workflow)
        self.assertIn('loadJsonContent(\'runtime-env.json\')', Path('infra/main.bicep').read_text())


if __name__ == '__main__':
    unittest.main()
