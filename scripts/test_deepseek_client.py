import json
import unittest
from deepseek_client import analyze_paper, validate_analysis, DEFAULT_MODEL, MAX_OUTPUT_TOKENS


def result(basis='title_and_abstract'):
    return {'category': 'ARCH', 'summary': '论文讨论量子编译方法。', 'contributions': ['摘要声称提出编译方法，尚未独立验证。'],
            'limitations': ['仅依据摘要，未读取全文。'], 'evidence_basis': basis, 'confidence': 0.7, 'tags': ['量子编译']}


def provider(value):
    return lambda *args: {'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(value)}}]}


class DeepSeekTests(unittest.TestCase):
    def test_injected_analysis_bounded_payload(self):
        def fake(payload, key, timeout):
            self.assertEqual(payload['model'], DEFAULT_MODEL)
            self.assertEqual(payload['max_tokens'], MAX_OUTPUT_TOKENS)
            self.assertNotIn('tools', payload)
            self.assertIn('untrusted', payload['messages'][0]['content'])
            return provider(result())()
        value = analyze_paper({'title': 'Quantum compiler', 'abstract': 'Some text'}, provider=fake)
        self.assertEqual(value['category'], 'ARCH')
        self.assertEqual(len(value['input_hash']), 64)

    def test_missing_abstract_safety(self):
        value = analyze_paper({'title': 'Quantum compiler'}, provider=provider(result('title_only')))
        self.assertEqual(value['contributions'], [])
        self.assertLessEqual(value['confidence'], 0.3)
        self.assertIn('缺少摘要', value['summary'])

    def test_opt_in_required(self):
        with self.assertRaisesRegex(ValueError, 'opt-in'):
            analyze_paper({'title': 'Test'})

    def test_invalid_schema_and_no_secret_leak(self):
        for patch in ({'tags': ['x' * 101]}, {'category': 'NEW'}, {'confidence': True}, {'evidence_basis': 'full_text'}, {'extra': 'no'}, {'summary': 'English only'}):
            with self.subTest(patch=patch), self.assertRaises(RuntimeError):
                analyze_paper({'title': 'Quantum', 'abstract': 'Text'}, provider=provider(result() | patch))
        def bad(*args):
            raise RuntimeError('sk-secret-key')
        with self.assertRaises(RuntimeError) as caught:
            analyze_paper({'title': 'Quantum'}, provider=bad, api_key='sk-secret-key')
        self.assertNotIn('sk-secret', str(caught.exception))

    def test_incomplete_and_truncated(self):
        with self.assertRaises(RuntimeError):
            analyze_paper({'title': 'Quantum'}, provider=lambda *args: {'choices': [{'finish_reason': 'length', 'message': {'content': '{}'}}]})
        value = analyze_paper({'title': 'Quantum', 'abstract': 'x' * 30000}, provider=provider(result()))
        self.assertIn('截断', value['limitations'][0])


if __name__ == '__main__':
    unittest.main()
