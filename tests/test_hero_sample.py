from pathlib import Path
from scripts.gen_hero_sample import generate_hero_sample_data, render_ts

ROOT = Path(__file__).resolve().parent.parent
COMMITTED_FILE = ROOT / "frontend" / "src" / "landing" / "heroSample.ts"


def test_hero_sample_matches_engine():
    assert COMMITTED_FILE.exists(), f"Committed file {COMMITTED_FILE} does not exist"
    data = generate_hero_sample_data()
    expected_ts = render_ts(data)
    actual_ts = COMMITTED_FILE.read_text(encoding="utf-8")
    assert actual_ts == expected_ts, "frontend/src/landing/heroSample.ts differs from engine output! Run scripts/gen_hero_sample.py"
