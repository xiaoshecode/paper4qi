import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse
from research_sources import fetch_venue, overlap_since, normalize_doi, venue_matches, _get_json, _retry_after, paper_from_crossref, conference_containers

JOURNAL = {'id': 'tqe', 'name': 'TQE', 'kind': 'journal', 'issn': '2689-1808'}
CONF = {'id': 'qce', 'name': 'QCE', 'kind': 'conference', 'container_title': 'IEEE International Conference on Quantum Computing and Engineering (QCE)'}


def item(doi='10.1234/abc', title='Quantum compiler'):
    return {'DOI': doi, 'title': [title], 'ISSN': ['2689-1808'],
            'container-title': ['IEEE Transactions on Quantum Engineering'],
            'published': {'date-parts': [[2020, 5]]}, 'abstract': '<jats:p>Quantum <b>computing</b></jats:p>'}


class SourcesTests(unittest.TestCase):
    def test_index_window_publication_and_dedup(self):
        urls = []
        def provider(url):
            urls.append(url)
            return {'message': {'items': [item(), item('https://doi.org/10.1234/ABC'), item('10.1234/other', 'Editorial')], 'next-cursor': 'x'}}
        result = fetch_venue(JOURNAL, '2026-11-01', '2026-11-10', provider=provider)
        self.assertTrue(result['complete'])
        self.assertEqual(result['checked_through'], '2026-11-10')
        self.assertEqual(len(result['papers']), 1)
        self.assertEqual(result['papers'][0]['published'], '2020-05-01')
        self.assertIn('from-index-date:2026-11-01', parse_qs(urlparse(urls[0]).query)['filter'][0])

    def test_truncated_never_checkpoints_and_resumes(self):
        first = fetch_venue(JOURNAL, '2026-11-01', '2026-11-10', 1,
                            provider=lambda _: {'message': {'items': [item()], 'next-cursor': 'cursor+next'}})
        self.assertFalse(first['complete'])
        self.assertIsNone(first['checked_through'])
        def final(url):
            self.assertEqual(parse_qs(urlparse(url).query)['cursor'], ['cursor+next'])
            return {'message': {'items': []}}
        last = fetch_venue(JOURNAL, first['since'], first['until'], 1, provider=final, continuation=first['continuation'])
        self.assertTrue(last['complete'])

    def test_scoped_conference_filters(self):
        def check(url):
            query = parse_qs(urlparse(url).query)
            self.assertNotIn('query.container-title', query)
            filters = query['filter'][0]
            self.assertIn('type:proceedings-article', filters)
            self.assertIn('container-title:2020 IEEE International', filters)
            self.assertIn('container-title:2026 IEEE International', filters)
            self.assertIn('container-title:2027 IEEE International', filters)
            self.assertNotIn('container-title:2028', filters)
            return {'message': {'items': []}}
        result = fetch_venue(CONF, '2026-11-01', '2026-11-10', provider=check)
        self.assertEqual(len(result['scope']['container_titles']), 9)
        annual = CONF | {'container_title': '2024 IEEE International Conference on Quantum Computing and Engineering (QCE)'}
        self.assertEqual(conference_containers(annual, '2026-11-10'), [annual['container_title']])
        self.assertEqual(conference_containers(CONF | {'container_title': 'Another conference'}, '2026-11-10'), ['Another conference'])

    def test_exact_conference(self):
        value = {'container-title': ['2026 IEEE International Conference on Quantum Computing and Engineering (QCE)']}
        self.assertTrue(venue_matches(value, CONF))
        value['container-title'][0] += ' Workshops'
        self.assertFalse(venue_matches(value, CONF))
        value['container-title'] = ['Unrelated Quantum Conference']
        self.assertFalse(venue_matches(value, CONF))

    def test_failures_sanitized(self):
        def bad(_):
            raise RuntimeError('secret abc')
        with self.assertRaisesRegex(RuntimeError, '^Crossref fetch failed; checkpoint unchanged$'):
            fetch_venue(JOURNAL, '2026-11-01', '2026-11-10', provider=bad)
        with self.assertRaises(ValueError):
            fetch_venue(JOURNAL, '2026-11-10', '2026-11-01')

    def test_retry_bounded_and_sanitized(self):
        error = HTTPError('https://api.crossref.org/works', 429, 'secret', {'Retry-After': '500'}, None)
        with patch('research_sources.urlopen', side_effect=error) as request, patch('research_sources.time.sleep') as sleep:
            with self.assertRaisesRegex(RuntimeError, '^Crossref request failed; checkpoint unchanged$'):
                _get_json('https://api.crossref.org/works')
            self.assertEqual(request.call_count, 3)
            self.assertEqual(sleep.call_count, 2)
            sleep.assert_called_with(30)
        self.assertEqual(_retry_after('invalid'), 1)

    def test_keyword_precision_license_and_type(self):
        value = item()
        value['license'] = [{'URL': 'https://creativecommons.org/licenses/by/4.0/', 'content-version': 'vor'}]
        paper = paper_from_crossref(value, JOURNAL | {'keywords': ['compiler']})
        self.assertEqual(paper['published_precision'], 'month')
        self.assertEqual(paper['licenses'][0]['content_version'], 'vor')
        self.assertIsNone(paper_from_crossref(value, JOURNAL | {'keywords': ['not matched']}))
        value.pop('published')
        self.assertEqual(paper_from_crossref(value, JOURNAL)['published_precision'], '')
        def check(url):
            self.assertIn('type:journal-article', parse_qs(urlparse(url).query)['filter'][0])
            return {'message': {'items': []}}
        fetch_venue(JOURNAL, '2026-11-01', '2026-11-10', provider=check)

    def test_overlap_and_doi(self):
        self.assertEqual(overlap_since('2026-11-10', '2020-01-01'), '2026-11-03')
        self.assertEqual(normalize_doi('https://doi.org/10.1234/ABC'), '10.1234/abc')
        self.assertEqual(normalize_doi('bad'), '')

    def test_irrelevant_and_wrong_issn(self):
        value = item()
        value['ISSN'] = ['0000-0000']
        result = fetch_venue(JOURNAL, '2026-11-01', '2026-11-10', provider=lambda _: {'message': {'items': [value]}})
        self.assertEqual(result['papers'], [])


if __name__ == '__main__':
    unittest.main()
