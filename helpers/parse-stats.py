#!/usr/bin/env python3
"""Emit GitHub Actions `key=value` lines from Playwright's test-results.json.

Produces the aggregate counts the Slack notification already consumed (total,
passed, failed, flaky, duration) PLUS an ASAP-vs-Future-Booking split derived
by classifying each test by its spec-file path (asap-only/ vs
future-booking-only/). Anything under neither directory is ignored for the
split but still counted in the aggregates.

Usage (in CI):  python3 helpers/parse-stats.py >> "$GITHUB_OUTPUT"
"""
import json


REPORT = "test-results.json"


def classify(file_path: str):
    if "future-booking-only" in file_path:
        return "future"
    if "asap-only" in file_path:
        return "asap"
    return None


def main() -> None:
    with open(REPORT) as fh:
        data = json.load(fh)

    stats = data.get("stats", {})
    expected = stats.get("expected", 0)
    unexpected = stats.get("unexpected", 0)
    skipped = stats.get("skipped", 0)
    flaky = stats.get("flaky", 0)
    total = expected + unexpected + skipped + flaky
    secs = int(stats.get("duration", 0) // 1000)

    agg = {
        "asap": {"p": 0, "f": 0, "fl": 0, "s": 0},
        "future": {"p": 0, "f": 0, "fl": 0, "s": 0},
    }
    bucket = {"expected": "p", "unexpected": "f", "flaky": "fl", "skipped": "s"}

    def walk(node: dict, file_path: str = "") -> None:
        file_path = node.get("file", file_path)
        mode = classify(file_path)
        for spec in node.get("specs", []):
            for test in spec.get("tests", []):
                key = bucket.get(test.get("status"))
                if mode is not None and key is not None:
                    agg[mode][key] += 1
        for child in node.get("suites", []):
            walk(child, file_path)

    for suite in data.get("suites", []):
        walk(suite)

    out = {
        "total": total,
        "passed": expected,
        "failed": unexpected,
        "flaky": flaky,
        "duration": f"{secs // 60}m {secs % 60}s",
        "asap_passed": agg["asap"]["p"],
        "asap_failed": agg["asap"]["f"],
        "asap_flaky": agg["asap"]["fl"],
        "future_passed": agg["future"]["p"],
        "future_failed": agg["future"]["f"],
        "future_flaky": agg["future"]["fl"],
    }
    for key, value in out.items():
        print(f"{key}={value}")


if __name__ == "__main__":
    main()
