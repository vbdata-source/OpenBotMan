"""
Simple example: Using OpenBotMan for a code task
"""

import sys
from pathlib import Path

# Add parent/src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from src.orchestrator import MultiAgentOrchestrator


def main():
    # Create orchestrator
    orchestrator = MultiAgentOrchestrator(config_path="../config.yaml")

    # Simple request
    print("Requesting: Implement binary search in Python\n")
    print("=" * 60)

    response = orchestrator.chat(
        "Implement a binary search function in Python with comprehensive tests. "
        "Use claude_code for implementation and gemini for review."
    )

    print("\nFinal Response:")
    print("=" * 60)
    print(response)

    # Show agent call history
    print("\n\nAgent Call History:")
    print("=" * 60)
    history = orchestrator.get_history()
    for i, call in enumerate(history, 1):
        print(f"\n{i}. {call['agent']} ({call['role']}):")
        print(f"   Task: {call['task'][:80]}...")
        print(f"   Response length: {len(call['response'])} chars")


if __name__ == "__main__":
    main()
