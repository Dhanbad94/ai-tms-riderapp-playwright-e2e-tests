# agent-runs/

Machine-readable output from the AI QA Agent (see `docs/QA_AGENT_PROMPT.md`,
Step 6). Each run writes one `agent-runs/<timestamp>.json`.

The per-run `*.json` files are **git-ignored** (they're run artifacts, not source);
this `README.md` and `.gitkeep` keep the directory in the repo. If you want a run's
output preserved in git, add it explicitly with `git add -f`.

## Schema

```json
{
  "build_version": "",
  "commit_range": "",
  "features_changed": [],
  "features_uncovered": [],
  "tests_run": 0,
  "results": { "passed": 0, "failed": 0, "flaky": 0 },
  "failures": [{ "test": "", "class": "", "evidence": "", "action": "" }],
  "bugs": [{ "title": "", "severity": "", "issue_url": "" }],
  "suggestions": [{ "screen": "", "suggestion": "" }],
  "prs": [],
  "needs_human": []
}
```

`failures[].class` is one of: `APP_BUG`, `TEST_OUTDATED`, `LOCATOR_BROKEN`, `FLAKY`, `ENV_ISSUE`
(see the triage table in `docs/QA_AGENT_PROMPT.md`).
