"""
Consensus example: Get multiple agents to agree on a decision
"""

import sys
from pathlib import Path

# Add parent/src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from src.orchestrator import MultiAgentOrchestrator


def main():
    orchestrator = MultiAgentOrchestrator(config_path="../config.yaml")

    print("Requesting consensus on technical decision")
    print("=" * 60)

    response = orchestrator.chat(
        "I need to choose between PostgreSQL and MongoDB for a new project. "
        "Requirements: ACID compliance, complex relationships, heavy read/write. "
        "Get consensus from all available agents."
    )

    print("\nFinal Response:")
    print("=" * 60)
    print(response)


if __name__ == "__main__":
    main()
