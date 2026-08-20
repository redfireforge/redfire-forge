"""Unit tests for RffMockServer (no live rff binary required — subprocess mocked)."""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from rff_mock.server import RffMockConfig, RffMockServer


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_mock_process(port_file: Path, port: int = 54321) -> MagicMock:
    """Return a fake subprocess.Popen that writes the port file immediately."""
    proc = MagicMock()
    proc.poll.return_value = None  # still running
    port_file.write_text(str(port))
    return proc


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestRffMockConfig:
    def test_defaults(self):
        cfg = RffMockConfig()
        assert cfg.timeout_secs == 30.0
        assert cfg.poll_interval_secs == 0.25
        assert cfg.server_id is None
        assert "rff" in cfg.rff_binary

    def test_rff_binary_env_override(self, monkeypatch):
        monkeypatch.setenv("RFF_BINARY", "/custom/rff")
        cfg = RffMockConfig()
        assert cfg.rff_binary == "/custom/rff"


class TestRffMockServer:
    def test_properties(self, tmp_path):
        port_file = tmp_path / "mock.port"
        proc = _make_mock_process(port_file, 54321)

        server = RffMockServer.__new__(RffMockServer)
        server._definition_file = "mocks/orders.json"
        server._config = RffMockConfig()
        server._process = proc
        server._port = 54321
        server._port_file = port_file

        assert server.port == 54321
        assert server.base_url == "http://localhost:54321"
        assert server.ready_url.endswith("/__rff/health/ready")
        assert server.live_url.endswith("/__rff/health/live")

    def test_raises_before_start(self):
        server = RffMockServer("mocks/orders.json")
        with pytest.raises(RuntimeError, match="not been started"):
            _ = server.port

    def test_stop_terminates_process(self, tmp_path):
        port_file = tmp_path / "mock.port"
        proc = _make_mock_process(port_file)

        server = RffMockServer.__new__(RffMockServer)
        server._process = proc
        server._port_file = port_file
        server._port = 54321
        server.stop()

        proc.terminate.assert_called_once()

    def test_stop_is_idempotent(self, tmp_path):
        server = RffMockServer("mocks/orders.json")
        server._process = None
        server._port_file = None
        server._port = None
        server.stop()  # should not raise

    def test_start_command_includes_correct_flags(self, tmp_path, monkeypatch):
        """Verify the CLI arguments passed to Popen."""
        captured_cmd = []

        def fake_popen(cmd, **kwargs):
            captured_cmd.extend(cmd)
            proc = MagicMock()
            proc.poll.return_value = None
            return proc

        def fake_wait_for_ready(self, port_file, cfg):
            # Simulate the port file being written
            port_file.write_text("54321")

        monkeypatch.setattr(subprocess, "Popen", fake_popen)
        monkeypatch.setattr(RffMockServer, "_wait_for_ready", fake_wait_for_ready)

        server = RffMockServer("mocks/orders.json",
                               RffMockConfig(server_id="srv-1"))
        server._start()

        assert "mock" in captured_cmd
        assert "start" in captured_cmd
        assert "--port" in captured_cmd
        assert "auto" in captured_cmd
        assert "--port-file" in captured_cmd
        assert "--standalone" in captured_cmd
        assert "--server" in captured_cmd
        assert "srv-1" in captured_cmd

    def test_timeout_on_missing_port_file(self, tmp_path):
        """_wait_for_ready should raise TimeoutError if port file never appears."""
        port_file = tmp_path / "never.port"
        cfg = RffMockConfig(timeout_secs=0.1, poll_interval_secs=0.05)

        server = RffMockServer("mocks/orders.json", cfg)
        with pytest.raises(TimeoutError, match="port file"):
            server._wait_for_ready(port_file, cfg)
