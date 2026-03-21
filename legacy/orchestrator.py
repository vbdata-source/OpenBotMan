#!/usr/bin/env python3
"""
OpenBotMan CLI - Interactive mode

Usage:
    python orchestrator.py
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.orchestrator import MultiAgentOrchestrator


def main():
    """CLI Interface"""

    print("=" * 60)
    print("🤖 OpenBotMan - Multi-Agent Orchestrator")
    print("=" * 60)
    print()

    try:
        orchestrator = MultiAgentOrchestrator()
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        print("\n💡 Quick setup:")
        print("  1. cp config.example.yaml config.yaml")
        print("  2. cp .env.example .env")
        print("  3. Edit .env with your ANTHROPIC_API_KEY")
        print("  4. Edit config.yaml with your agent settings")
        sys.exit(1)
    except ValueError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

    print("✓ Orchestrator initialized")
    print(f"✓ Available agents: {', '.join(orchestrator.config['agents'].keys())}")
    print(f"✓ Available workflows: {', '.join(orchestrator.config.get('workflows', {}).keys())}")
    print()
    print("Commands:")
    print("  - Type your request and press Enter")
    print("  - 'reset' - Clear conversation")
    print("  - 'history' - Show agent call history")
    print("  - 'exit' - Quit")
    print()

    while True:
        try:
            user_input = input("You: ").strip()

            if not user_input:
                continue

            if user_input.lower() == "exit":
                print("\n👋 Goodbye!")
                break

            if user_input.lower() == "reset":
                orchestrator.reset()
                print()
                continue

            if user_input.lower() == "history":
                history = orchestrator.get_history()
                if not history:
                    print("No agent calls yet.\n")
                else:
                    print("\n📋 Agent Call History:")
                    for i, entry in enumerate(history, 1):
                        print(f"\n{i}. {entry['agent']} ({entry['role']}):")
                        print(f"   Task: {entry['task'][:100]}...")
                        print(f"   Response: {entry['response'][:200]}...")
                print()
                continue

            # Process request
            print()
            response = orchestrator.chat(user_input)
            print(f"\n🤖 Orchestrator:\n{response}\n")

        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}\n")


if __name__ == "__main__":
    main()
