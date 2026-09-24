# -*- coding: utf-8 -*-
"""Retry errored entries and missing PDF downloads, then re-run matcher for dropped errors."""
import json, os, sys, re, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match_arxiv import download_pdf, load_matches, save_matches

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

matches = load_matches()
errors = [k for k, v in matches.items() if v.get('status') == 'error']
for k in errors:
    del matches[k]
save_matches(matches)
print('dropped errors:', len(errors))

retried = ok = 0
for k, v in matches.items():
    if v.get('status') == 'match' and not v.get('pdf'):
        short = re.sub(r'v\d+$', '', v['arxiv_id'])
        fn, success = download_pdf(short)
        if success:
            v['pdf'] = os.path.relpath(fn, BASE).replace(os.sep, '/')
            ok += 1
        retried += 1
        time.sleep(1.5)
save_matches(matches)
print(f'retried pdf downloads: {retried}, newly ok: {ok}')
