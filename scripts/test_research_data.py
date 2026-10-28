"""Focused checks for reproducible topic discovery (not relevance judgements)."""
import unittest
from build_research_data import match_paper


class TopicMatchingTests(unittest.TestCase):
    def setUp(self):
        self.paper = {'id': 'qce:test', 'title': 'FPGA real-time decoder', 'abstract': 'A surface-code experiment.',
                      'tags': ['control'], 'zh': 'photon', 'front_matter': False}
        self.topic = {'keywords': ['real time', 'surface code', 'control'], 'exclude_keywords': []}

    def test_field_weights_and_normalization(self):
        match = match_paper(self.paper, self.topic)
        self.assertEqual(match['score'], 6)
        self.assertEqual(match['matched_terms'], ['real time', 'surface code', 'control'])

    def test_word_boundaries_and_secondary_notes(self):
        self.assertIsNone(match_paper(self.paper, {'keywords': ['codeword', 'photon', 'deco']}))

    def test_exclusions_and_front_matter(self):
        self.assertIsNone(match_paper(self.paper, {**self.topic, 'exclude_keywords': ['surface code']}))
        self.assertIsNone(match_paper({**self.paper, 'front_matter': True}, self.topic))

    def test_missing_abstract_and_tags(self):
        self.assertEqual(match_paper({**self.paper, 'abstract': None, 'tags': []}, self.topic)['score'], 3)

    def test_plural_recall_and_no_duplicate_weighting(self):
        paper = {**self.paper, 'title': 'Dynamic circuits and real-time feedback'}
        topic = {'keywords': ['dynamic circuit', 'real time', 'real-time']}
        match = match_paper(paper, topic)
        self.assertEqual(match['score'], 6)
        self.assertEqual(len(match['matched_terms']), 2)


if __name__ == '__main__':
    unittest.main()
