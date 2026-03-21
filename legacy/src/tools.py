"""Tools available to the orchestrator agent"""

from typing import List, Dict, Any, Optional
from .cli_runners import CLIRunner, CLIResponse
import json


class OrchestratorTools:
    """Tools available to the orchestrator agent"""

    def __init__(self, cli_runner: CLIRunner, config: Dict[str, Any]):
        self.cli = cli_runner
        self.config = config
        self.conversation_history: List[Dict[str, str]] = []

    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """Return Anthropic-style tool definitions"""
        return [
            {
                "name": "call_agent",
                "description": (
                    "Call a sub-agent (claude_code, gemini, gpt4) with a specific task and role. "
                    "The agent will process the task according to its specialization."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "agent_id": {
                            "type": "string",
                            "enum": list(self.config['agents'].keys()),
                            "description": "Which agent to call"
                        },
                        "role": {
                            "type": "string",
                            "enum": ["planner", "coder", "reviewer", "critic", "tester", "optimizer", "architect"],
                            "description": "What role should the agent take"
                        },
                        "task": {
                            "type": "string",
                            "description": "The specific task for the agent"
                        },
                        "context": {
                            "type": "string",
                            "description": "Additional context from previous agent outputs"
                        }
                    },
                    "required": ["agent_id", "role", "task"]
                }
            },
            {
                "name": "create_consensus",
                "description": (
                    "Get consensus from multiple agents on a topic. "
                    "Useful for validation, review, or decision-making."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "agents": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of agent IDs to consult"
                        },
                        "topic": {
                            "type": "string",
                            "description": "Topic or question for consensus"
                        },
                        "min_agreement": {
                            "type": "number",
                            "description": "Minimum agreement ratio (0-1) required",
                            "default": 0.7
                        }
                    },
                    "required": ["agents", "topic"]
                }
            },
            {
                "name": "run_workflow",
                "description": (
                    "Execute a predefined workflow (e.g., code_review). "
                    "Workflows coordinate multiple agents in a structured sequence."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "workflow_name": {
                            "type": "string",
                            "enum": list(self.config.get('workflows', {}).keys()),
                            "description": "Name of the workflow to execute"
                        },
                        "input_data": {
                            "type": "string",
                            "description": "Input data for the workflow"
                        }
                    },
                    "required": ["workflow_name", "input_data"]
                }
            }
        ]

    def call_agent(
        self,
        agent_id: str,
        role: str,
        task: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute call_agent tool"""

        # Build role-specific system prompt
        system_prompt = self._build_role_prompt(agent_id, role)

        # Build full prompt with context
        full_prompt = task
        if context:
            full_prompt = f"Context:\n{context}\n\nTask:\n{task}"

        # Execute CLI
        response = self.cli.run_cli(
            agent_id=agent_id,
            prompt=full_prompt,
            system_prompt=system_prompt
        )

        # Log to history
        self.conversation_history.append({
            "agent": agent_id,
            "role": role,
            "task": task,
            "response": response.text
        })

        return {
            "agent": agent_id,
            "role": role,
            "response": response.text,
            "session_id": response.session_id,
            "usage": response.usage
        }

    def create_consensus(
        self,
        agents: List[str],
        topic: str,
        min_agreement: float = 0.7
    ) -> Dict[str, Any]:
        """Execute create_consensus tool"""

        responses = []
        votes = {"approve": 0, "reject": 0}

        for agent_id in agents:
            prompt = (
                f"Evaluate this and vote APPROVE or REJECT:\n\n{topic}\n\n"
                f"Provide reasoning then vote."
            )

            response = self.cli.run_cli(
                agent_id=agent_id,
                prompt=prompt,
                system_prompt="You are a critical reviewer. Be thorough."
            )

            # Count votes
            text_upper = response.text.upper()
            if "APPROVE" in text_upper:
                votes["approve"] += 1
            elif "REJECT" in text_upper:
                votes["reject"] += 1

            responses.append({
                "agent": agent_id,
                "response": response.text
            })

        total = len(agents)
        agreement = votes["approve"] / total if total > 0 else 0
        consensus_reached = agreement >= min_agreement

        return {
            "consensus": consensus_reached,
            "agreement_ratio": agreement,
            "votes": votes,
            "responses": responses,
            "decision": "APPROVED" if consensus_reached else "NEEDS_REVISION"
        }

    def run_workflow(
        self,
        workflow_name: str,
        input_data: str
    ) -> Dict[str, Any]:
        """Execute run_workflow tool"""

        workflow = self.config.get('workflows', {}).get(workflow_name)
        if not workflow:
            raise ValueError(f"Unknown workflow: {workflow_name}")

        results = []
        current_context = input_data

        for step in workflow['steps']:
            agent_id = step['agent']
            role = step['role']
            task_template = step['task']

            # Build task with context
            task = f"{task_template}\n\nInput:\n{current_context}"

            # Execute step
            result = self.call_agent(
                agent_id=agent_id,
                role=role,
                task=task,
                context=current_context
            )

            results.append(result)

            # Check if we need iterations
            max_iterations = step.get('max_iterations', 1)
            if max_iterations > 1:
                for iteration in range(max_iterations - 1):
                    # Ask if satisfied
                    feedback_prompt = (
                        f"Review this output:\n{result['response']}\n\n"
                        f"Reply APPROVED if satisfied, or provide improvements."
                    )

                    feedback = self.cli.run_cli(
                        agent_id=agent_id,
                        prompt=feedback_prompt
                    )

                    if "APPROVED" in feedback.text.upper():
                        break

                    # Iterate
                    result = self.call_agent(
                        agent_id=agent_id,
                        role=role,
                        task=f"Improve based on:\n{feedback.text}\n\nOriginal:\n{task}",
                        context=current_context
                    )
                    results.append(result)

            # Update context for next step
            current_context = result['response']

        return {
            "workflow": workflow_name,
            "steps_completed": len(results),
            "results": results,
            "final_output": current_context
        }

    def _build_role_prompt(self, agent_id: str, role: str) -> str:
        """Build system prompt based on role"""

        role_prompts = {
            "planner": (
                "You are a strategic planner. Create detailed, step-by-step plans. "
                "Consider edge cases, dependencies, and potential risks."
            ),
            "coder": (
                "You are an expert coder. Write clean, well-documented, tested code. "
                "Follow best practices and design patterns."
            ),
            "reviewer": (
                "You are a critical code reviewer. Identify bugs, security issues, "
                "performance problems, and suggest improvements."
            ),
            "critic": (
                "You are a constructive critic. Find flaws but also suggest solutions. "
                "Be thorough and uncompromising in quality standards."
            ),
            "tester": (
                "You are a QA engineer. Design comprehensive test suites. "
                "Think about edge cases, error handling, and integration scenarios."
            ),
            "optimizer": (
                "You are a performance optimization specialist. Focus on efficiency, "
                "scalability, and resource usage."
            ),
            "architect": (
                "You are a system architect. Design scalable, maintainable systems. "
                "Consider long-term implications and technical debt."
            )
        }

        base_prompt = role_prompts.get(role, "You are a helpful assistant.")

        # Add agent-specific traits
        if agent_id == "gemini":
            base_prompt += "\n\nYou excel at creative problem-solving and critical thinking."
        elif agent_id == "claude_code":
            base_prompt += "\n\nYou excel at reasoning and coding."

        return base_prompt

    def execute_tool(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by name"""

        if tool_name == "call_agent":
            return self.call_agent(**tool_input)
        elif tool_name == "create_consensus":
            return self.create_consensus(**tool_input)
        elif tool_name == "run_workflow":
            return self.run_workflow(**tool_input)
        else:
            raise ValueError(f"Unknown tool: {tool_name}")
