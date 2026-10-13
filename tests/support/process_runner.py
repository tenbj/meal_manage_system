"""Bounded commands: reap our own process tree before callers clean resources."""
import os
import secrets
import signal
import subprocess


def stop_tree(process):
    if os.name == 'nt':
        result = subprocess.run(
            ['taskkill', '/PID', str(process.pid), '/T', '/F'],
            capture_output=True, timeout=15,
            creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode and process.poll() is None:
            raise RuntimeError('Could not terminate owned command tree')
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    return process.communicate(timeout=15)


def run_command(args, *, cwd, log_dir=None, input=None, timeout=240):
    process = subprocess.Popen(
        args, cwd=cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, start_new_session=os.name != 'nt')
    timed_out = False
    try:
        stdout, stderr = process.communicate(input, timeout=timeout)
    except BaseException as original:
        # Cancellation must finish before the caller's compose-down finally runs.
        try:
            stdout, stderr = stop_tree(process)
        except BaseException as cleanup:
            original.add_note('Owned command cleanup failed: ' + type(cleanup).__name__)
            raise original
        if not isinstance(original, subprocess.TimeoutExpired):
            raise
        timed_out = True
    if process.returncode or timed_out:
        log = 'command-failure-' + secrets.token_hex(4) + '.log'
        if log_dir is not None:
            (log_dir / log).write_bytes(stdout + stderr)
        raise RuntimeError(('Command timed out' if timed_out else 'Command failed')
                           + '; private ' + log + ' retained: ' + str(args[0]))
    return stdout
