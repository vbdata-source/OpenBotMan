"""Tests for orchestrator tools"""

import pytest
from src.tools import OrchestratorTools
from src.cli_runners import CLIRunner


@pytest.fixture
def config():
    return {
        "agents": {
            "claude_code": {
                "cli": "claude",
                "roles": ["planner", "coder"]
            },
            "gemini": {
                "cli": "gemini",
                "roles": ["reviewer"]
            }
        },
        "workflows": {
            "test_workflow": {
                "steps": [
                    {"agent": "claude_code", "role": "planner", "task": "Plan"}
                ]
            }
        }
    }


@pytest.fixture
def tools(config):
    cli_runner = CLIRunner(config)
    return OrchestratorTools(cli_runner, config)


def test_get_tool_definitions(tools):
    """Test tool definitions"""
    definitions = tools.get_tool_definitions()

    assert len(definitions) == 3
    tool_names = [t["name"] for t in definitions]
    assert "call_agent" in tool_names
    assert "create_consensus" in tool_names
    assert "run_workflow" in tool_names


def test_build_role_prompt(tools):
    """Test role prompt building"""
    prompt = tools._build_role_prompt("claude_code", "planner")

    assert "planner" in prompt.lower()
    assert len(prompt) > 0


def test_conversation_history(tools):
    """Test conversation history tracking"""
    assert len(tools.conversation_history) == 0

    # History should be populated after agent calls
    # (Would need mocking for full test)
