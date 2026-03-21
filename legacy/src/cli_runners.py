"""CLI subprocess runners for different LLM CLIs"""

import subprocess
import json
import uuid
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class CLIResponse:
    """Response from a CLI execution"""
    text: str
    session_id: Optional[str] = None
    usage: Optional[Dict[str, int]] = None
    raw_output: str = ""


class CLIRunner:
    """Handles subprocess execution of various LLM CLIs"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.sessions: Dict[str, str] = {}  # agent_id -> session_id

    def run_cli(
        self,
        agent_id: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 120
    ) -> CLIResponse:
        """Execute CLI and return parsed response"""

        agent_config = self.config['agents'].get(agent_id)
        if not agent_config:
            raise ValueError(f"Unknown agent: {agent_id}")

        # Build command
        cmd = [agent_config['cli']] + agent_config.get('args', [])

        # Add model
        if model:
            cmd.extend([agent_config['model_arg'], model])
        elif agent_config.get('default_model'):
            cmd.extend([agent_config['model_arg'], agent_config['default_model']])

        # Session management
        session_id = self.sessions.get(agent_id)
        if not session_id:
            session_id = str(uuid.uuid4())
            self.sessions[agent_id] = session_id

        if agent_config.get('session_arg'):
            cmd.extend([agent_config['session_arg'], session_id])

        # System prompt
        if system_prompt and agent_config.get('system_prompt_arg'):
            cmd.extend([agent_config['system_prompt_arg'], system_prompt])

        # Prompt as last argument
        cmd.append(prompt)

        print(f"[CLI] Executing: {agent_config['cli']} (prompt: {len(prompt)} chars)")

        # Execute
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )

            if result.returncode != 0:
                raise RuntimeError(f"CLI failed: {result.stderr}")

            # Parse response
            return self._parse_response(result.stdout, agent_id)

        except subprocess.TimeoutExpired:
            raise RuntimeError(f"CLI timeout after {timeout}s")

    def _parse_response(self, output: str, agent_id: str) -> CLIResponse:
        """Parse JSON output from CLI"""
        try:
            data = json.loads(output.strip())

            # Extract text (different CLIs have different structures)
            text = ""
            if isinstance(data.get('message'), dict):
                text = data['message'].get('content', '')
            elif isinstance(data.get('content'), str):
                text = data['content']
            elif isinstance(data.get('text'), str):
                text = data['text']
            else:
                text = str(data)

            # Extract session ID
            session_id = (
                data.get('session_id') or
                data.get('sessionId') or
                data.get('conversation_id')
            )

            # Extract usage
            usage = None
            if isinstance(data.get('usage'), dict):
                usage = {
                    'input': data['usage'].get('input_tokens', 0),
                    'output': data['usage'].get('output_tokens', 0),
                }

            return CLIResponse(
                text=text.strip(),
                session_id=session_id,
                usage=usage,
                raw_output=output
            )

        except json.JSONDecodeError:
            # Fallback: return raw output
            return CLIResponse(
                text=output.strip(),
                raw_output=output
            )

    def reset_session(self, agent_id: str):
        """Reset session for an agent"""
        if agent_id in self.sessions:
            del self.sessions[agent_id]
