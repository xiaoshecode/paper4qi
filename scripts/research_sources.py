"""Bounded Crossref discovery. Checkpoints refer to indexed dates, not publication.

Only a complete successful window may advance a checkpoint. Replay windows with
an overlap and merge by normalized DOI to catch updates without duplicate papers.
No network calls occur at import time. Providers receive a URL and return JSON.
"""
import datetime as dt
import html
import json
import re
import time
import unicodedata
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from email.utils import parsedate_to_datetime
from lib_taxonomy import categorize_tqe, is_front_matter

MAX_RESPONSE_BYTES = 8_000_000


def _retry_after(value):
    try:
        seconds = float(value)
    except (ValueError, TypeError):
        try:
            seconds = (parsedate_to_datetime(value) - dt.datetime.now(dt.timezone.utc)).total_seconds()
        except (ValueError, TypeError, OverflowError):
            return 1
    return max(0, min(30, seconds))


def _get_json(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'paper4qi-research/1.0 (Crossref discovery)', 'Accept': 'application/json'}), timeout=30) as response:
                raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise ValueError('response too large')
            return json.loads(raw)
        except HTTPError as error:
            if error.code in (429, 503) and attempt < 2:
                time.sleep(_retry_after(error.headers.get('Retry-After')) if error.headers.get('Retry-After') else min(30, 2 ** attempt))
                continue
            break
        except Exception:
            break
    raise RuntimeError('Crossref request failed; checkpoint unchanged') from None


def normalize_doi(value):
    value = re.sub(r'^https?://(?:dx\.)?doi\.org/', '', str(value or '').strip(), flags=re.I).lower()
    return value if re.fullmatch(r'10\.\d{4,9}/\S+', value) else ''


def _text(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', str(value or '')))).strip()


def _container(value):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', _text(value)).casefold()).strip()


def venue_matches(item, venue):
    if venue['kind'] == 'journal':
        return venue['issn'].upper() in [str(x).upper() for x in item.get('ISSN', [])]
    expected = _container(venue['container_title'])
    for title in item.get('container-title', []):
        candidate = _container(title)
        if not re.match(r'^\d{4}\s+', expected):
            candidate = re.sub(r'^\d{4}\s+', '', candidate)
        if candidate == expected:
            return True
    return False


def relevant(title, abstract):
    return bool(re.search(r'\b(quantum|qubits?|qasm|qec|qaoa|vqe|cryo[- ]?cmos|superconducting|trapped[- ]ion|neutral[- ]atom)\b', title + ' ' + abstract, re.I))


def _published(item):
    for field in ('published', 'published-online', 'published-print', 'issued'):
        parts = item.get(field, {}).get('date-parts', [[]])[0]
        try:
            if not parts:
                continue
            return dt.date(*(parts + [1, 1])[:3]).isoformat(), ('day' if len(parts) >= 3 else 'month' if len(parts) == 2 else 'year')
        except (ValueError, TypeError):
            continue
    return '', ''


def paper_from_crossref(item, venue):
    doi = normalize_doi(item.get('DOI'))
    title = _text(next(iter(item.get('title', [])), ''))
    abstract = _text(item.get('abstract'))
    if not doi or not title or is_front_matter(title) or re.fullmatch(r'(editorial|preface|foreword|table of contents|index)', title, re.I) or not relevant(title, abstract):
        return None
    keywords = venue.get('keywords', [])
    if keywords and not any(str(word).casefold() in (title + ' ' + abstract).casefold() for word in keywords):
        return None
    category = categorize_tqe({'title': title, 'abstract': abstract})[0]
    published, precision = _published(item)
    return {'id': 'discovery:' + doi, 'doi': doi, 'title': title,
            'authors': [_text(' '.join(filter(None, [a.get('given'), a.get('family')])) or a.get('name', '')) for a in item.get('author', [])],
            'abstract': abstract, 'venue': _text(next(iter(item.get('container-title', [])), venue['name'])),
            'year': int(published[:4]) if published else 0, 'published': published,
            'published_precision': precision,
            'licenses': [{'url': entry['URL'], 'content_version': entry.get('content-version', ''), 'start': entry.get('start', {}).get('date-time', '')} for entry in item.get('license', []) if isinstance(entry, dict) and isinstance(entry.get('URL'), str)],
            'source': 'crossref', 'source_url': 'https://doi.org/' + quote(doi, safe='/'),
            'category': category, 'tags': [], 'zh': '【待解读】' if abstract else '【仅题名元数据，缺少摘要，待核实】',
            'front_matter': False, 'followed_venue_id': venue['id']}


QCE_CONTAINER = 'IEEE International Conference on Quantum Computing and Engineering (QCE)'


def conference_containers(venue, until):
    """Exact server filters, not a relevance search across unrelated proceedings.

    Crossref container-title filters are exact and repeated values are ORed.
    QCE's verified series begins in 2020; include annual titles through the window
    year plus one (early deposits). Other conferences require an exact configured title. This does not
    promise coverage of renamed volumes, workshops or unregistered works.
    """
    title = venue['container_title'].strip()
    if _container(title) == _container(QCE_CONTAINER):
        year = dt.date.fromisoformat(until).year
        if year > 2100:
            raise ValueError('QCE discovery year exceeds bounded supported range')
        return [title] + [f'{year} {title}' for year in range(2020, year + 2)]
    return [title]


def fetch_venue(venue, since, until, max_items=100, *, provider=None, continuation=None):
    """Fetch at most max_items raw results, not max_items matches.

    continuation is a Crossref cursor returned by a previous bounded call. Resume
    with the identical venue/window; persist partial papers but never checkpoint
    until complete. Conservative false completeness is avoided by a final empty
    cursor page when exactly a page worth of results was returned.
    """
    start, end = dt.date.fromisoformat(since), dt.date.fromisoformat(until)
    if start > end or not 1 <= max_items <= 10000:
        raise ValueError('Invalid date window or max_items (1..10000)')
    if venue.get('kind') not in ('journal', 'conference'):
        raise ValueError('Venue kind must be journal or conference')
    if venue['kind'] == 'journal' and not re.fullmatch(r'\d{4}-[\dXx]{4}', venue.get('issn', '')):
        raise ValueError('Journal requires a verified ISSN')
    if venue['kind'] == 'conference' and (not isinstance(venue.get('container_title'), str) or not venue.get('container_title', '').strip()):
        raise ValueError('Conference requires verified exact container titles')
    containers = conference_containers(venue, until) if venue['kind'] == 'conference' else []
    get = provider or _get_json
    cursor, scanned, papers = continuation or '*', 0, {}
    complete = False
    while scanned < max_items:
        rows = min(100, max_items - scanned)
        work_type = 'journal-article' if venue['kind'] == 'journal' else 'proceedings-article'
        params = {'filter': f'from-index-date:{since},until-index-date:{until},type:{work_type}', 'rows': rows, 'cursor': cursor}
        if venue['kind'] == 'journal':
            endpoint = 'https://api.crossref.org/journals/' + quote(venue['issn'], safe='') + '/works'
        else:
            endpoint = 'https://api.crossref.org/works'
            params['filter'] += ''.join(',container-title:' + title for title in containers)
        try:
            response = get(endpoint + '?' + urlencode(params))
            message = response['message']
            items = message['items']
            if not isinstance(items, list) or len(items) > rows:
                raise ValueError('invalid response')
            for item in items:
                if venue_matches(item, venue):
                    paper = paper_from_crossref(item, venue)
                    if paper:
                        papers[paper['doi']] = paper
            scanned += len(items)
            if len(items) < rows:
                complete = True
                break
            next_cursor = message.get('next-cursor')
            if not next_cursor:
                raise ValueError('missing continuation')
            cursor = next_cursor
        except Exception:
            raise RuntimeError('Crossref fetch failed; checkpoint unchanged') from None
        if provider is None and scanned < max_items:
            time.sleep(1)
    return {'papers': list(papers.values()), 'complete': complete,
            'checked_through': until if complete else None,
            'continuation': None if complete else cursor, 'scanned': scanned,
            'since': since, 'until': until,
            'scope': {'container_titles': containers, 'issn': venue.get('issn'),
                      'coverage': 'Crossref indexed matching records only; renamed volumes, workshops, missing deposits and containers beyond the window year plus one may be absent.'}}


def overlap_since(checkpoint, fallback, days=7):
    """Inclusive overlap for recently reindexed/late-deposited works."""
    if days < 0:
        raise ValueError('Overlap must be nonnegative')
    return (dt.date.fromisoformat(checkpoint) - dt.timedelta(days=days)).isoformat() if checkpoint else dt.date.fromisoformat(fallback).isoformat()
