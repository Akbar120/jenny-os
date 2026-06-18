# Integrate Arbor AI Research Agent into Antigravity (AG Kit)

This plan integrates the **RUC-NLPIR/Arbor** autonomous research agent framework into Antigravity (AG Kit) as a new capability, enabling a structured hypothesis-tree research workflow.

## Success Criteria
- [x] Arbor codebase cloned to `e:\Antigravity\arbor`
- [x] Arbor CLI installed and verified with `arbor doctor`
- [x] `/arbor` slash command workflow created in `.agents/workflows/arbor.md`
- [x] `arbor-researcher` agent defined in `.agents/agent/arbor-researcher.md`
- [x] `arbor-research` skill documented in `.agents/skills/arbor-research/SKILL.md`
- [x] Simple mock benchmark created in `e:\Antigravity\arbor_example_benchmark`
- [x] Dry run successfully finishes 1 cycle of Arbor

## Proposed Changes

### AG Kit Integration

#### [NEW] [arbor.md](file:///e:/Antigravity/.agents/workflows/arbor.md)
Creates the `/arbor` slash command workflow.

#### [NEW] [arbor-researcher.md](file:///e:/Antigravity/.agents/agent/arbor-researcher.md)
Defines the `arbor-researcher` specialist agent.

#### [NEW] [SKILL.md](file:///e:/Antigravity/.agents/skills/arbor-research/SKILL.md)
The playbook containing detailed instructions for executing Arbor cycles.

---

### Example Benchmark Setup

#### [NEW] [run_eval.py](file:///e:/Antigravity/arbor_example_benchmark/run_eval.py)
A script that evaluates a prompt's performance on a simple math word problem dataset.

#### [NEW] [prompt.txt](file:///e:/Antigravity/arbor_example_benchmark/prompt.txt)
The initial prompt template to be optimized by Arbor.

#### [NEW] [dataset.json](file:///e:/Antigravity/arbor_example_benchmark/dataset.json)
Contains training (dev) and held-out (test) splits of math questions.

#### [NEW] [research_config.yaml](file:///e:/Antigravity/arbor_example_benchmark/research_config.yaml)
Arbor project configuration specifying the target metric, evaluator, and budget constraints.

---

### Installation & Clone

#### [NEW] [install_arbor.ps1](file:///e:/Antigravity/install_arbor.ps1)
A setup script that clones Arbor and installs it.

## Verification Plan

### Automated Steps
1. Execute `install_arbor.ps1` to ensure Arbor installs cleanly.
2. Run `arbor doctor` to verify that PATH, git, and keys are configured correctly.
3. Start a dry run using `arbor --cwd ./arbor_example_benchmark --max-cycles 1` to ensure the coordinator and executor loops run without errors.

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass
- Security: ✅ No critical issues
- Build: ✅ Success
- Date: 2026-06-16
