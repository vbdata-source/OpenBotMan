"""
Workflow example: Using predefined code_review workflow
"""

import sys
from pathlib import Path

# Add parent/src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from src.orchestrator import MultiAgentOrchestrator


def main():
    orchestrator = MultiAgentOrchestrator(config_path="../config.yaml")

    print("Running code_review workflow")
    print("=" * 60)

    response = orchestrator.chat(
        "Run the code_review workflow for implementing OAuth2 authentication "
        "with PKCE flow in a Node.js Express application."
    )

    print("\nFinal Response:")
    print("=" * 60)
    print(response)

    # Show workflow steps
    print("\n\nWorkflow Steps Executed:")
    print("=" * 60)
    history = orchestrator.get_history()
    for i, call in enumerate(history, 1):
        print(f"\nStep {i}: {call['agent']} ({call['role']})")
        print(f"Task: {call['task'][:100]}...")


if __name__ == "__main__":
    main()
