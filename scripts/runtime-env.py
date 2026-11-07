#!/usr/bin/env python3
"""Validate and apply the versioned runtime-only configuration."""
import copy
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

MANIFEST = 'infra/runtime-env.json'
APP = 'hhc-web'


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.DEVNULL, text=True)


def validate(data):
    if not isinstance(data, dict) or set(data) != {'resources'} or set(data['resources']) != {APP}:
        raise ValueError('Expected only the hhc-web resource')
    env = data['resources'][APP]
    if not isinstance(env, dict):
        raise ValueError('Expected environment object')
    for key, value in env.items():
        if key == 'RELEASE' or not re.fullmatch(r'[A-Z][A-Z0-9_]*', key) or key.startswith(('NEXT_PUBLIC_', 'VITE_')):
            raise ValueError('Invalid or build-time environment name')
        if value is None:
            continue
        if isinstance(value, dict) and set(value) == {'secretRef'} and isinstance(value['secretRef'], str) and re.fullmatch(r'[a-z0-9][a-z0-9-]*', value['secretRef']):
            continue
        if not isinstance(value, dict) or set(value) != {'value'}:
            raise ValueError('Expected value, existing secretRef, or null')
        value = value['value']
        if not isinstance(value, str) or not value or value.startswith('secretref:') or len(value) > 8192 or any(c in value for c in '\r\n\x00'):
            raise ValueError('Expected a nonempty literal value')
    return env


def config_only(event, base, head):
    if event not in ('push', 'pull_request') or not all(re.fullmatch('[0-9a-f]{40}', sha) and set(sha) != {'0'} for sha in (base, head)):
        return False
    if run('git', 'rev-parse', 'HEAD').strip() != head:
        return False
    run('git', 'merge-base', '--is-ancestor', base, head)
    raw = run('git', 'diff', '--raw', '--no-abbrev', '--no-renames', '--no-ext-diff', '--no-textconv', base, head, '--')
    if not re.fullmatch(r':100644 100644 [0-9a-f]{40} [0-9a-f]{40} M\t' + re.escape(MANIFEST) + r'\n', raw):
        return False
    before = validate(json.loads(run('git', 'show', f'{base}:{MANIFEST}')))
    after = validate(json.loads(run('git', 'show', f'{head}:{MANIFEST}')))
    # Removing ownership needs a full release; null explicitly removes a runtime key.
    return set(before) <= set(after)


def wait_revision(revision):
    for _ in range(60):
        try:
            props=json.loads(run('az','containerapp','revision','show','-g','alive','-n',APP,'--revision',revision,'-o','json','--only-show-errors'))['properties']
            state=props.get('provisioningState')
        except subprocess.CalledProcessError:
            state=None
        if state in ('Provisioned','Succeeded'):
            return
        if state in ('Failed','ProvisioningFailed'):
            raise ValueError('Runtime revision provisioning failed')
        time.sleep(5)
    raise ValueError('Runtime revision provisioning timed out')


def deploy(env):
    if not env:
        return
    state = json.loads(run('az', 'containerapp', 'show', '-g', 'alive', '-n', APP,
        '-o', 'json', '--only-show-errors'))
    props = state['properties']
    if not props['latestReadyRevisionName'] or props['configuration']['activeRevisionsMode'] != 'Single':
        raise ValueError('Expected one current ready revision')
    template = json.loads(run('az', 'containerapp', 'revision', 'show', '-g', 'alive', '-n', APP,
        '--revision', props['latestReadyRevisionName'], '-o', 'json', '--only-show-errors'))['properties']['template']
    template = copy.deepcopy(template)
    containers = template['containers']
    if len(containers) != 1 or containers[0]['name'] != APP or not re.fullmatch(r'alive\.azurecr\.io/alive/hhc-web@sha256:[0-9a-f]{64}', containers[0]['image']):
        raise ValueError('Expected an immutable hhc-web image')
    for value in env.values():
        if value is not None and 'secretRef' in value and value['secretRef'] not in {s['name'] for s in props['configuration'].get('secrets', [])}:
            raise ValueError('Referenced secret must already exist')
    previous = containers[0].get('env', [])
    updated = [v for v in previous if v['name'] not in env] + [dict(name=k, **v) for k,v in env.items() if v is not None]
    if sorted(previous,key=lambda v:v['name']) == sorted(updated,key=lambda v:v['name']):
        return
    containers[0]['env'] = updated
    suffix = 'env-' + os.environ['GITHUB_RUN_ID'] + '-' + os.environ['GITHUB_RUN_ATTEMPT']
    if not re.fullmatch(r'env-[0-9]+-[0-9]+', suffix):
        raise ValueError('Invalid revision identity')
    template['revisionSuffix'] = suffix
    result = subprocess.run(['az', 'rest', '--method', 'patch', '--url',
        'https://management.azure.com' + state['id'] + '?api-version=2025-01-01',
        '--body', '@/dev/stdin', '--only-show-errors', '-o', 'none'],
        input=json.dumps({'properties': {'template': template}}), text=True,
        capture_output=True, timeout=300)
    if result.returncode:
        raise ValueError('Runtime template update failed')
    wait_revision(APP + '--' + suffix)


def validate_transition(event, base, head):
    if event not in ('push', 'pull_request') or not all(re.fullmatch('[0-9a-f]{40}', sha) and set(sha) != {'0'} for sha in (base, head)):
        return
    changed = subprocess.check_output(['git', 'diff', '--name-only', base, head, '--', 'infra/runtime-env.json'], text=True)
    if not changed:
        return
    def read(sha):
        result = subprocess.run(['git', 'show', sha + ':infra/runtime-env.json'], capture_output=True, text=True)
        if result.returncode:
            if sha == base:
                return {}
            raise ValueError('Runtime manifest must remain present')
        text = result.stdout
        return {APP: validate(json.loads(text))}
    before, after = read(base), read(head)
    if any(not set(owned) <= set(after[target]) for target, owned in before.items()):
        raise ValueError('Use null tombstones; do not delete owned keys')


if __name__ == '__main__':
    if len(sys.argv) == 5 and sys.argv[1] == 'classify':
        try:
            validate_transition(*sys.argv[2:])
        except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError):
            sys.exit('Invalid runtime configuration transition; values withheld')
        try:
            result = config_only(*sys.argv[2:])
        except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError):
            result = False
        print('config_only=' + str(result).lower())
    else:
        try:
            env = validate(json.loads(Path(MANIFEST).read_text()))
            if sys.argv[1:] == ['deploy']:
                if os.environ.get('GITHUB_REF') != 'refs/heads/main':
                    raise ValueError('Runtime deployment requires merged main')
                before = validate(json.loads(run('git', 'show', os.environ['BASE_SHA'] + ':' + MANIFEST)))
                if not set(before) <= set(env):
                    raise ValueError('Use null for explicit removals; do not delete owned keys')
                deploy(env)
            elif sys.argv[1:] != ['validate']:
                raise ValueError('Unknown command')
        except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError):
            sys.exit('Runtime configuration validation/update failed; values are not logged.')
