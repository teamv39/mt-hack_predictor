"""Baseline submission generator for Moscow Transport Hackathon.

Generates immediate baseline submission where predicted delay equals the last
known deviation (prediction = cur_dev_s) on dataset/validate/points.csv.
Guarantees correct CSV formatting (semicolon delimiter, sample_id;prediction).
"""

from __future__ import annotations

import argparse
import csv
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("make_baseline_sub")


def generate_baseline_submission(
    points_path: str | Path = "dataset/validate/points.csv",
    output_path: str | Path = "data/submissions/submission_baseline.csv",
) -> Path:
    """Generates baseline submission file from validate points."""
    points_file = Path(points_path)
    output_file = Path(output_path)

    if not points_file.is_file():
        raise FileNotFoundError(f"Validate points file not found at: {points_file}")

    output_file.parent.mkdir(parents=True, exist_ok=True)

    rows: list[tuple[str, str]] = []

    # Use built-in csv module for zero-dependency reliability
    import csv

    with open(points_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            sample_id = r["sample_id"].strip()
            cur_dev_raw = r.get("cur_dev_s", "0.0")
            try:
                cur_dev = float(cur_dev_raw) if cur_dev_raw else 0.0
            except ValueError:
                cur_dev = 0.0
            rows.append((sample_id, f"{cur_dev:.1f}"))

    logger.info(f"Loaded {len(rows)} validation points from {points_file}")

    # Write semicolon-delimited submission file
    with open(output_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(["sample_id", "prediction"])
        for sid, pred in rows:
            writer.writerow([sid, pred])

    logger.info(f"Baseline submission written to {output_file}")

    # Validation checks
    with open(output_file, "r", encoding="utf-8") as f:
        lines = f.readlines()

    header = lines[0].strip()
    assert header == "sample_id;prediction", f"Invalid header: {header}"
    assert len(lines) == len(rows) + 1, (
        f"Expected {len(rows) + 1} lines, got {len(lines)}"
    )

    logger.info(
        f"Verification PASSED: {len(rows)} rows, header '{header}', "
        f"sample row: {lines[1].strip()}"
    )
    return output_file


def main():
    parser = argparse.ArgumentParser(description="Generate baseline submission")
    parser.add_argument(
        "--points",
        type=str,
        default="dataset/validate/points.csv",
        help="Path to validate points.csv",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/submissions/submission_baseline.csv",
        help="Path to output submission CSV",
    )
    args = parser.parse_args()

    generate_baseline_submission(args.points, args.output)


if __name__ == "__main__":
    main()
