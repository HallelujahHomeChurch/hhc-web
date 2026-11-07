#!/usr/bin/env python3
"""Refresh only desired settings under the release lock; never refresh code."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('settings',ROOT/'scripts'/'runtime-env.py')
settings=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(settings)
SOURCE=ROOT/'infra/runtime-env.json'


def parse(text):
    return {'hhc-web':settings.validate(json.loads(text))}


def refresh():
    if os.environ.get('GITHUB_REF') != 'refs/heads/main':
        raise ValueError('Settings refresh requires merged main')
    text=subprocess.check_output(['gh','api','-H','Accept: application/vnd.github.raw+json',
        'repos/'+os.environ['GITHUB_REPOSITORY']+'/contents/infra/runtime-env.json?ref=main'],
        text=True,stderr=subprocess.DEVNULL)
    current=parse(SOURCE.read_text())
    latest=parse(text)
    if any(not set(owned) <= set(latest[target]) for target,owned in current.items()):
        raise ValueError('Use null tombstones; do not delete owned keys')
    SOURCE.write_text(text)


if __name__=='__main__':
    try:
        refresh()
    except (ValueError,KeyError,TypeError,OSError,subprocess.SubprocessError):
        raise SystemExit('Unable to refresh desired runtime settings; values withheld')
