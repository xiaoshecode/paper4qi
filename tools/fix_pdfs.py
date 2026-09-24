# -*- coding: utf-8 -*-
"""Link curl-downloaded PDFs into matches JSON and validate all files start with %PDF."""
import json, os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match_arxiv import load_matches, save_matches, PDF_DIR

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
matches = load_matches()

fixed = 0
for k, v in matches.items():
    if v.get('status') == 'match' and not v.get('pdf'):
        short = re.sub(r'v\d+$', '', v['arxiv_id'])
        fn = os.path.join(PDF_DIR, short + '.pdf')
        if os.path.exists(fn) and os.path.getsize(fn) > 10000:
            with open(fn, 'rb') as f:
                if f.read(4) == b'%PDF':
                    v['pdf'] = os.path.relpath(fn, BASE).replace(os.sep, '/')
                    fixed += 1
save_matches(matches)
print('linked:', fixed)

bad = 0
files = sorted(os.listdir(PDF_DIR))
for fn in files:
    p = os.path.join(PDF_DIR, fn)
    with open(p, 'rb') as f:
        if f.read(4) != b'%PDF':
            print('BAD FILE:', fn, os.path.getsize(p))
            bad += 1
print(f'pdf files: {len(files)}, invalid: {bad}')
m = sum(1 for v in matches.values() if v.get('status') == 'match')
p = sum(1 for v in matches.values() if v.get('pdf'))
print(f'match={m} pdf={p}')
