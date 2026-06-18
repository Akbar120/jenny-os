---
description: Start an autonomous research session using Arbor AI to optimize a codebase or benchmark.
---

# /arbor — Run Arbor AI Research Agent

$ARGUMENTS

---

## 🔴 CRITICAL RULES

1. **Intake First:** Always confirm the Research Contract (Goal, Target Directory, Metric, Baseline, and Budget) with the user before starting.
2. **Safe Workspace:** Ensure the target directory is a clean Git repository before dispatching.
3. **Use the Right Config:** Read `research_config.yaml` or help the user generate a minimal one if it does not exist.
4. **Environment Check:** Run `arbor doctor` first to ensure the API keys, Git, and Python paths are valid.

---

## Task

Start or resume an Arbor research session using the `arbor-research` skill:

```
CONTEXT:
- Target Directory: $ARGUMENTS (or default to current workspace)
- Config File: research_config.yaml (if present)

WORKFLOW:
1. RUN `arbor doctor` to diagnose environment setup.
2. LOAD `arbor-research` skill.
3. IF no `research_config.yaml` is present, HELP the user create a minimal one.
4. RUN the intake conversation to establish the Research Contract.
5. START the research cycle: `arbor --cwd [path]` (or with `--config [file]`).
6. RENDER a live summary of the Idea Tree and evidence as Arbor progresses.
```

---

## Expected Output

```
## Arbor Research Session

### Research Contract
* **Goal:** [Goal description]
* **Target:** [Directory path]
* **Metric:** [Metric name]
* **Baseline:** [Initial score]
* **Budget:** [Max cycles/hours]

### Progress
* **Status:** 🚀 Session started (Run: `research/run_xxx`)
* **Idea Tree:** View the tree structure under `.arbor/sessions/` or run `arbor report` to re-render.
* **Commands:**
  - `/arbor-status` (Check current cycle and scores)
  - `/arbor-pause` / `/arbor-resume`
  - `/arbor-report` (Generate final REPORT.md)
```

---

## Usage Examples

```
/arbor
/arbor --cwd ./arbor_example_benchmark
/arbor "improve accuracy" --cwd ./arbor_example_benchmark
```
