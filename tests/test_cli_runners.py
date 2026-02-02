"""Tests for CLI runners"""

import pytest
from src.cli_runners import CLIRunner, CLIResponse


def test_cli_response_dataclass():
    """Test CLIResponse dataclass"""
    response = CLIResponse(
        text="Hello world",
        session_id="test-123",
        usage={"input": 100, "output": 50}
    )

    assert response.text == "Hello world"
    assert response.session_id == "test-123"
    assert response.usage["input"] == 100
    assert response.usage["output"] == 50


def test_cli_runner_init():
    """Test CLIRunner initialization"""
    config = {
        "agents": {
            "test_agent": {
                "cli": "test",
                "args": ["--json"]
            }
        }
    }

    runner = CLIRunner(config)
    assert runner.config == config
    assert runner.sessions == {}


def test_session_management():
    """Test session ID management"""
    config = {
        "agents": {
            "test_agent": {
                "cli": "echo",
                "args": [],
                "default_model": "test"
            }
        }
    }

    runner = CLIRunner(config)

    # Initially no session
    assert "test_agent" not in runner.sessions

    # Reset creates no session
    runner.reset_session("test_agent")
    assert "test_agent" not in runner.sessions


# Note: Full CLI execution tests would require actual CLI binaries
# Those are better done as integration tests
