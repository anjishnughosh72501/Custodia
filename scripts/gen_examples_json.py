"""Generates frontend/src/examples.generated.json from app/examples.py.

This provides the bundled static fallback of example scenarios so the chips
in the UI are instantly visible and never disappear during server cold starts.
"""
from __future__ import annotations
import json
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from app.examples import EXAMPLES

DEST = REPO_ROOT / "frontend" / "src" / "examples.generated.json"


def main():
    DEST.parent.mkdir(parents=True, exist_ok=True)
    with open(DEST, "w", encoding="utf-8") as f:
        json.dump(EXAMPLES, f, indent=2)
    print(f"Generated {DEST} with {len(EXAMPLES)} examples.")


if __name__ == "__main__":
    main()
