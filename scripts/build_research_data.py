"""Build a transparent, multi-label research map from reviewed topic definitions.

Keyword associations are discovery leads, never paper-level review decisions.
The corpus Paper schema and its existing 13-category labels are unchanged.
"""
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


def normalize(value):
    text = unicodedata.normalize('NFKC', value or '').lower()
    return re.sub(r'\s+', ' ', re.sub(r'[-‐‑–—/]', ' ', text)).strip()


def contains(text, keyword):
    key = normalize(keyword)
    if not key:
        return False
    plural = r's?' if re.search(r'[a-z]{4,}$', key) and not key.endswith('s') else ''
    return re.search(r'(?<![a-z0-9])' + re.escape(key) + plural + r'(?![a-z0-9])', text) is not None


def match_paper(paper, topic):
    if paper['front_matter']:
        return None
    fields = [(normalize(paper['title']), 3), (normalize(paper.get('abstract')), 1),
              (normalize(' '.join(paper.get('tags', []))), 2)]
    combined = ' '.join(text for text, _ in fields)
    if any(contains(combined, key) for key in topic.get('exclude_keywords', [])):
        return None
    keywords = list({normalize(key): key for key in reversed(topic['keywords'])}.values())[::-1]
    found = [(key, max((weight for text, weight in fields if contains(text, key)), default=0))
             for key in keywords]
    found = [(key, score) for key, score in found if score]
    if not found:
        return None
    return {'id': paper['id'], 'score': sum(score for _, score in found),
            'matched_terms': [key for key, _ in found]}


def build_research_map(out_dir, source_dir, papers, generated):
    files = sorted((Path(source_dir) / 'research').glob('*.json'))
    domains, topics, topic_ids = [], [], set()
    rows = {paper['id']: paper for paper in papers}
    matched_ids = set()
    for path in files:
        domain = json.loads(path.read_text(encoding='utf-8-sig'))
        keys = []
        for definition in domain['subtopics']:
            key = definition['key']
            if key in topic_ids or not re.fullmatch(r'[a-z][a-z0-9-]*', key):
                raise ValueError(f'Invalid or duplicate research topic key: {key}')
            topic_ids.add(key)
            for required in ('title_zh', 'title_en', 'description_zh', 'questions_zh', 'keywords', 'sources', 'research_gaps_zh', 'next_steps_zh'):
                if not definition.get(required):
                    raise ValueError(f'{key} missing {required}')
            for source in definition['sources']:
                if not source['url'].startswith('https://') or not source.get('title') or not source.get('note_zh'):
                    raise ValueError(f'{key} has an incomplete source')
            matches = [match for paper in papers if (match := match_paper(paper, definition))]
            matches.sort(key=lambda match: (-match['score'], -rows[match['id']]['year'], match['id']))
            matched_ids.update(match['id'] for match in matches)
            counts = dict(Counter(rows[match['id']]['source'] for match in matches))
            topics.append({**definition, 'domain': domain['key'], 'reviewed': domain['reviewed'],
                           'matched_count': len(matches), 'matched_sources': counts, 'matched_papers': matches})
            keys.append(key)
        domains.append({key: value for key, value in domain.items() if key != 'subtopics'} | {'topics': keys})
    output = {
        'schema_version': '1.0.0', 'generated': generated,
        'scope': 'Curated quantum infrastructure topic map with primary-source reading lists and reproducible keyword associations to the selected QCE/TQE corpus.',
        'method': {'fields': ['title', 'abstract', 'tags'], 'normalization': 'Unicode NFKC, lowercase, dash/slash to space, collapsed whitespace, Latin word boundaries',
                   'matching': 'Any listed phrase matches, unless an exclusion phrase matches. A final Latin word of at least four letters permits a regular plural s; normalized duplicate phrases are scored once. Multi-label; suggested categories are contextual, not hard filters.',
                   'ranking': 'Sum per phrase of best field weight: title 3, tag 2, abstract 1; then year descending and stable ID.',
                   'review_status': 'Automated topic associations are unreviewed discovery leads. Primary-source notes are curated separately; research gaps are editorial synthesis, not established novelty claims.'},
        'counts': {'domains': len(domains), 'topics': len(topics),
                   'source_links': sum(len(t['sources']) for t in topics),
                   'unique_source_links': len({s['url'] for t in topics for s in t['sources']}),
                   'associated_records': len(matched_ids),
                   'unassociated_research_records': sum(not p['front_matter'] and p['id'] not in matched_ids for p in papers)},
        'domains': domains, 'topics': topics,
        'limitations': ['The map is an organizing framework, not an exhaustive systematic review.',
                       'A missing match is not evidence that a research topic lacks literature; synonym and abstract gaps cause false negatives.',
                       'Matched records can be false positives and must be screened. Front matter is excluded; QCE26 remains program metadata.',
                       'Reference review dates describe this curated pass. They do not certify the whole corpus, future versions or current submission deadlines.'],
    }
    Path(out_dir, 'research-map.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return output
