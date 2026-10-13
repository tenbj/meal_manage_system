"""Execute runner's finally block against fakes; no Docker calls."""
import ast
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[2]
tree = ast.parse((ROOT / 'tests/docker/run.py').read_text(encoding='utf8'))
final = next(node.finalbody for node in reversed(tree.body) if isinstance(node, ast.Try))
cleanup_code = compile(ast.Module(body=final, type_ignores=[]), '<runner-cleanup>', 'exec')


class DockerCleanupTests(unittest.TestCase):
    def exercise(self, down_error=None, proxy_error=None, read_error=None):
        report = {'error': 'original failure'}
        calls = []

        def run(args):
            calls.append(args)
            if read_error and 'volume' in args:
                raise read_error
            return b''

        scope = dict(report=report, a=SimpleNamespace(keep_on_failure=False),
                     proxy=object() if proxy_error else None,
                     stop_tree=Mock(side_effect=proxy_error),
                     compose=Mock(side_effect=down_error), run=run,
                     project='h02test-meal-synthetic', existing={}, json=json,
                     now=lambda: 'synthetic-time', save=Mock(), check=Mock(),
                     print=Mock(), work=Path('synthetic-private'))
        exec(cleanup_code, scope)
        self.assertEqual(report['error'], 'original failure')
        self.assertEqual(len(calls), 3)
        scope['compose'].assert_called_once()
        scope['save'].assert_called_once()
        return report

    def test_down_failure_still_reads_all_resources(self):
        report = self.exercise(down_error=RuntimeError())
        self.assertIn('cleanup_error', report)
        self.assertEqual(report['remaining_resources'], dict(containers=[], volumes=[], networks=[]))

    def test_second_keyboard_interrupt_keeps_original_and_reads_resources(self):
        self.assertIn('cleanup_error', self.exercise(down_error=KeyboardInterrupt()))

    def test_proxy_cancellation_still_runs_down(self):
        self.assertIn('cleanup_error', self.exercise(proxy_error=SystemExit(2)))

    def test_resource_read_cancellation_keeps_other_reads(self):
        report = self.exercise(read_error=KeyboardInterrupt())
        self.assertIsNone(report['remaining_resources']['volumes'])
        self.assertEqual(report['remaining_resources']['networks'], [])

    def test_python_text_io_explicit_encoding(self):
        for directory in ['tests', 'scripts']:
            for path in (ROOT / directory).rglob('*.py'):
                for node in ast.walk(ast.parse(path.read_text(encoding='utf8'))):
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in ['read_text', 'write_text']:
                        self.assertTrue(any(key.arg == 'encoding' for key in node.keywords), f'{path.name}:{node.lineno}')


if __name__ == '__main__':
    unittest.main()
