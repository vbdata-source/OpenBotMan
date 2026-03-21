"""Main orchestrator that coordinates multiple LLM agents"""

import anthropic
import yaml
import json
import os
from pathlib import Path
from typing import Dict, Any, List
from dotenv import load_dotenv

from .cli_runners import CLIRunner
from .tools import OrchestratorTools

# Load environment variables
load_dotenv()


class MultiAgentOrchestrator:
    """Main orchestrator that coordinates multiple LLM agents"""

    def __init__(self, config_path: str = "config.yaml"):
        # Load config
        config_file = Path(config_path)
        if not config_file.exists():
            raise FileNotFoundError(
                f"Config file not found: {config_path}\n"
                f"Copy config.example.yaml to config.yaml and customize it."
            )

        with open(config_file) as f:
            self.config = yaml.safe_load(f)

        # Initialize components
        self.cli_runner = CLIRunner(self.config)
        self.tools = OrchestratorTools(self.cli_runner, self.config)

        # Initialize Anthropic client for orchestrator
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY not found in environment.\n"
                "Set it in .env file or as environment variable."
            )

        self.client = anthropic.Anthropic(api_key=api_key)

        # Conversation state
        self.messages: List[Dict[str, Any]] = []
        self.system_prompt = self._build_system_prompt()

    def _build_system_prompt(self) -> str:
        """Build orchestrator system prompt"""

        available_agents = list(self.config['agents'].keys())
        available_workflows = list(self.config.get('workflows', {}).keys())

        return f"""You are a Multi-Agent Orchestrator.

Your role: Coordinate multiple specialized AI agents to accomplish complex tasks.

Available agents: {', '.join(available_agents)}
- claude_code: Expert at planning, architecture, and coding
- gemini: Expert at critical thinking, review, and optimization
- gpt4: Expert at testing and documentation

Available tools:
- call_agent: Delegate a task to a specific agent with a role
- create_consensus: Get agreement from multiple agents
- run_workflow: Execute predefined multi-step workflows

Available workflows: {', '.join(available_workflows)}

Guidelines:
1. Break complex tasks into subtasks for different agents
2. Use each agent's strengths (Claude for code, Gemini for review)
3. Validate important decisions with consensus
4. Iterate until quality standards are met
5. Synthesize outputs into coherent final result

When uncertain, ask clarifying questions before delegating."""

    def chat(self, user_message: str) -> str:
        """Main chat interface with orchestrator"""

        # Add user message
        self.messages.append({
            "role": "user",
            "content": user_message
        })

        # Agentic loop
        max_iterations = self.config['orchestrator']['max_iterations']

        for iteration in range(max_iterations):
            print(f"[Orchestrator] Iteration {iteration + 1}/{max_iterations}")

            # Call Claude (orchestrator)
            response = self.client.messages.create(
                model=self.config['orchestrator']['model'],
                max_tokens=4096,
                system=self.system_prompt,
                tools=self.tools.get_tool_definitions(),
                messages=self.messages
            )

            # Add assistant response
            self.messages.append({
                "role": "assistant",
                "content": response.content
            })

            # Check stop reason
            if response.stop_reason == "end_turn":
                # Final answer
                return self._extract_text(response.content)

            elif response.stop_reason == "tool_use":
                # Execute tools
                tool_results = []

                for block in response.content:
                    if block.type == "tool_use":
                        print(f"[Orchestrator] Executing tool: {block.name}")
                        print(f"[Orchestrator] Input: {json.dumps(block.input, indent=2)}")

                        try:
                            result = self.tools.execute_tool(
                                block.name,
                                block.input
                            )

                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": json.dumps(result, indent=2)
                            })

                            print(f"[Orchestrator] Result: Success")

                        except Exception as e:
                            print(f"[Orchestrator] Result: Error - {str(e)}")
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": f"Error: {str(e)}",
                                "is_error": True
                            })

                # Add tool results to conversation
                self.messages.append({
                    "role": "user",
                    "content": tool_results
                })

        return "Max iterations reached without final answer."

    def _extract_text(self, content: List[Any]) -> str:
        """Extract text from response content"""
        texts = []
        for block in content:
            if hasattr(block, 'text'):
                texts.append(block.text)
        return "\n".join(texts)

    def reset(self):
        """Reset conversation state"""
        self.messages = []
        self.tools.conversation_history = []
        self.cli_runner.sessions = {}
        print("[Orchestrator] Conversation reset.")

    def get_history(self) -> List[Dict[str, str]]:
        """Get conversation history"""
        return self.tools.conversation_history
