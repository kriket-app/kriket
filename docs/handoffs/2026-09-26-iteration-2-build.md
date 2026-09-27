# Handoff: build iteration 2 on Claude, alongside the Qwen experiment (Sat 2026-09-26, 19:15 Saskatoon time)

For a fresh Claude Code session started in `~/Code/kriket`, and for Erik and Theo. **Notion task:** none (hackathon repo); PRs carry no task-ID suffix.

## Why there are two tracks

Erik's decision, 19:10: iteration 2 is built twice, from the same plan, at the same time.

- **The Claude track ships.** A fresh Claude session (you, if you are reading this as the resume prompt told you to) executes the build plan with Claude subagents, merges task by task to `main`, and every merge deploys. This is how the hackathon gets done tonight.
- **The Qwen track is an experiment.** The session that wrote this keeps five agents running on the kit's team model (Qwen3 Coder 30B on the GPU box) inside the kit's dev container, gated by the kit's verifier, as far as they get. It never merges to `main`. At the end the two tracks are compared.

## Read first

1. `docs/plans/2026-09-27-iteration-2-build.md` (PR #23): the API contract, Tasks 0 to 7, the rulings. **This is the plan you execute.** Task 0 is already merged (PR #24).
2. `docs/plans/2026-09-27-iteration-2-proposal.md` (PR #20, PR #22): the spec as Theo decided it; where the plan and the proposal disagree, the proposal wins.
3. `docs/handoffs/2026-09-26-iteration-1.md`, the section "The working style that worked (keep)": contract first, parallel implementers by directory, a reviewer per task, one whole-branch review on the strongest model, one fix wave, rulings reported back, PRs with every callout and nobody tagged, merge by hand when green, verify on the real thing.

## State at handoff

`main` is `aaaf95f` (PR #24 merged). Merged today after iteration 1: PR #18 (Theo's feedback), #20 (the proposal), #22 (Theo's decisions folded in), #23 (the build plan), #24 (Task 0). Theo's PR #21 (a PWA) is open and being reviewed by another session: leave it alone, and note the PWA is out of scope for iteration 2 per the proposal.

## How the Claude track runs (deviations from the plan's "How it runs")

The plan was written for agents on the team model. For your track:

- **Implementers are Claude subagents**, each in its own git worktree (the Agent tool's `isolation: "worktree"`). Mid tier (Sonnet) where the plan carries the code (Tasks 1, 3, 4, 6), strong tier (Opus) for design-heavy work (Tasks 2 and 5). A fresh reviewer per task on the mid tier; the whole-iteration review on the strongest model.
- **Order** as the plan says: Tasks 1, 4, 5, and 6 in parallel; Task 2 after Task 1 merges; Task 3 after Task 2; then the review, one fix wave, and Task 7.
- **Branches:** `i2/<task>`, e.g. `i2/backend`, `i2/stream-form`, `i2/tags`, `i2/landing`, `i2/overview`, `i2/balances`. Never use the `qwen/` prefix.
- **Gate per task:** `make check`, the backend tests (`cd backend && npm test`, on the `kriket-pg` Postgres container at `localhost:5432`, database `app_test`), and, for parity with the Qwen track, the kit's verifier: `bash ~/Code/xenia-2026/plugin/scripts/agent-verify.sh --worktree <worktree> --base origin/main` (it writes `.agent/STATUS.json`; do not commit that folder). Then CI on the PR, which also runs the Playwright tests.
- **PRs:** one per task, every callout in the description, nobody tagged, ready for review, `gh pr create` only; merge by hand when every check is green (`main` has a ruleset requiring `check`). No Notion suffix.
- **After each merge:** smoke-test https://app.26.cohack.tetl.ca (sign up a throwaway user, try what the task added), then post a short comment on PR #20 for Theo: what merged, what to try, the board link. Sign comments "*Written by Claude Code on Erik's behalf.*"
- **Local tooling:** Node 26 is pinned but Node 24 is installed; run npm with `npm_config_engine_strict=false` and Node 24 first on `PATH` (the helper `bash ~/.config/kriket-agents/bin/fe.sh <checkout> <frontend|backend> <command…>` does both). Do not install Node 26 mid-build.

## What belongs to whom (so the tracks never collide)

| Thing | Owner |
|---|---|
| `main`, the `i2/*` branches, PRs from them, deploys | Claude track |
| Comments on PR #20 about the build | Claude track |
| The board: source `~/Code/kriket-pages/board.html`, published to https://26.cohack.tetl.ca/kriket/board/ with `bash ~/.config/kriket-agents/bin/publish-page.sh ~/Code/kriket-pages/board.html kriket/board` and as the private artifact https://claude.ai/artifact/Ah3BPevM1qL1w3iRb8Zed6 (republish with that `url`) | Claude track |
| Containers `kriket-agent-*`, clones in `~/Code/kriket-agents/`, the gateway key in `~/.config/kriket-agents/`, the `qwen/*` branches, the GPU box | Qwen session; do not touch |
| The experiment page https://26.cohack.tetl.ca/kriket/qwen/ | Qwen session |
| The prototype tour (`tour/2-proposal`, `/tour/2-proposal/`) | Qwen session, as part of the experiment; if it never lands, Task 7's refreshed real-app tour replaces it |

The board's `BOARD` data block at the bottom of the file is all you edit: task statuses, the log, the estimate. Keep the link to the experiment page.

## Measure your track (for the comparison)

For each task, write down: start and end time (from `date`), how many implementer runs and fix rounds it took, what the reviewer found, whether CI passed first time, and the subagent's token usage if the Agent result reports it. Put the table in the iteration 2 handoff you write at the end (Task 7), under "Claude track". The Qwen session records the same for its track on the experiment page.

## Resume prompt for the Claude session

> Read `docs/handoffs/2026-09-26-iteration-2-build.md`, then `docs/plans/2026-09-27-iteration-2-build.md` and the iteration 1 handoff's working style. Execute the build plan's Tasks 1 to 7 on the Claude track exactly as the handoff describes: Claude subagents in worktrees, `i2/*` branches, one PR per task with every callout and nobody tagged, merge by hand when green, smoke-test the live app after each merge, a short progress comment on PR #20 for Theo, and the board updated at every step. Do not touch anything the handoff assigns to the Qwen session. Record the per-task measurements for the comparison.
