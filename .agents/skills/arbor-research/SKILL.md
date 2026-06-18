---
name: arbor-research
description: Playbook for executing the Arbor hypothesis-tree refinement cycle.
when_to_use: "When optimizing a codebase, prompt system, or ML model that has a concrete evaluation metric and script. NOT for general coding, layout fixing, or standalone debugging."
allowed-tools: Read, Grep, Glob, Bash, Run
---

# Arbor Research Playbook

Use this playbook to guide the execution of autonomous research sessions using the Arbor framework.

## 🏁 Session Initialization: The Research Contract

Before starting, establish a **Research Contract** with the user. Identify:
- **Target Goal:** What are we trying to accomplish?
- **Target Directory:** The codebase or folder containing the project.
- **Evaluation Command:** The exact command (e.g. `python eval.py`) that outputs a metric.
- **Target Metric:** The value we want to optimize (e.g. "Accuracy", "Loss", "F1 Score").
- **Budget:** Number of allowed cycles or total LLM budget.

---

## 🔄 The 6-Step Cycle

For each research cycle, execute these steps:

### 1. Observe
- Read the current Idea Tree state.
- Analyze the most recent run's output and failure logs.
- Identify bottleneck issues (e.g., "slow retrieval," "hallucinations on math," "high loss").

### 2. Ideate
- Brainstorm 1–3 concrete code/prompt changes to resolve the bottleneck.
- For each idea, define:
  - **Hypothesis:** Why will this change help?
  - **Proposed Implementation:** What file and what lines will change?
- Document these as child branches in the Idea Tree.

### 3. Select
- Select the leaf node with the highest confidence or potential impact.
- Avoid repeating ideas that have already failed.

### 4. Dispatch
- Create a dedicated Git worktree: `git worktree add -b research/run_[name]/branch_[id] ../worktrees/[id]`
- Implement the proposed changes inside the worktree.
- Run the evaluation script inside the worktree.
- Log stdout/stderr and extract the metric score.

### 5. Backpropagate
- Record the score and key learnings into the Idea Tree node.
- Write down why the idea succeeded or failed (e.g. "improved math accuracy but degraded general formatting").
- Remove/prune the worktree directory safely.

### 6. Decide
- If the score is higher than the current trunk score (by the configured merge margin):
  - Merge the worktree branch into the run's `trunk` branch.
  - Update the baseline score.
- If it failed to improve, prune the branch (mark it as inactive).
- Decide whether to start a new cycle or exit if the budget is exhausted.

---

## 🎛️ CLI Quick Commands

When interacting with the CLI:
- Run `arbor` to start.
- Use `arbor doctor` to diagnose environment setup.
- Use `arbor report` to generate a markdown summary of the Idea Tree and scores.
