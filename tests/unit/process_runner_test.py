"""Offline regressions; starts only synthetic local Python process trees."""
import importlib.util
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('process_runner', ROOT / 'tests/support/process_runner.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ProcessCleanupTests(unittest.TestCase):
    def exercise(self, cancellation=None):
        with tempfile.TemporaryDirectory(dir=ROOT / '.test-runs') as directory:
            marker = pathlib.Path(directory) / 'orphan-marker'
            ready = pathlib.Path(directory) / 'ready'
            child = 'import time,pathlib;time.sleep(2);pathlib.Path(' + repr(str(marker)) + ').write_text("orphan")'
            parent = ('import subprocess,sys,time,pathlib;subprocess.Popen([sys.executable,"-c",'
                      + repr(child) + ']);pathlib.Path(' + repr(str(ready))
                      + ').write_text("ready");time.sleep(30)')
            created = []
            real_popen = subprocess.Popen

            def launch(*args, **kwargs):
                process = real_popen(*args, **kwargs)
                if not created:
                    created.append(process)
                    deadline = time.monotonic() + 5
                    while not ready.exists() and time.monotonic() < deadline:
                        time.sleep(.02)
                    self.assertTrue(ready.exists())
                    if cancellation is not None:
                        communicate = process.communicate
                        calls = 0

                        def interrupted(*a, **kw):
                            nonlocal calls
                            calls += 1
                            if calls == 1:
                                raise cancellation
                            return communicate(*a, **kw)
                        process.communicate = interrupted
                return process

            try:
                with patch.object(runner.subprocess, 'Popen', side_effect=launch):
                    with self.assertRaises(type(cancellation) if cancellation else RuntimeError) as raised:
                        runner.run_command([sys.executable, '-c', parent], cwd=ROOT,
                                           log_dir=pathlib.Path(directory), timeout=.1)
                    if cancellation:
                        self.assertIs(raised.exception, cancellation)
                self.assertIsNotNone(created[0].poll())
                time.sleep(2.2)
                self.assertFalse(marker.exists(), 'Descendant survived command cancellation')
            finally:
                if created and created[0].poll() is None:
                    runner.stop_tree(created[0])

    def test_keyboard_interrupt_reaps_tree_and_preserves_original(self):
        self.exercise(KeyboardInterrupt())

    def test_system_exit_reaps_tree_and_preserves_original(self):
        self.exercise(SystemExit(7))

    def test_timeout_reaps_tree(self):
        self.exercise()

    def test_cleanup_failure_preserves_cancel(self):
        original = KeyboardInterrupt()
        with patch.object(runner.subprocess, 'Popen') as popen, patch.object(runner, 'stop_tree', side_effect=RuntimeError('synthetic')):
            popen.return_value.communicate.side_effect = original
            with self.assertRaises(KeyboardInterrupt) as raised:
                runner.run_command(['synthetic'], cwd=ROOT)
            self.assertIs(raised.exception, original)
            self.assertTrue(original.__notes__)


if __name__ == '__main__':
    (ROOT / '.test-runs').mkdir(exist_ok=True)
    unittest.main()
