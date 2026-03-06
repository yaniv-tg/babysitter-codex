# babysitter-codex

Babysitter orchestration plugin for [OpenAI Codex CLI](https://github.com/openai/codex). It adds structured multi-step AI workflows with quality convergence, lifecycle hooks, and 11 slash commands.

This project was created by Babysitter already running on Codex.

## What You Get

- Slash-command workflow orchestration in Codex
- Iterative execution loop (`run:create` -> `run:iterate` -> `task:post`)
- Breakpoint support for interactive approvals
- Yolo mode for non-interactive auto-approval
- Compatibility mode for SDK builds that expose only core run/task commands
- Deterministic per-run trace log at `<runDir>/run-trace.jsonl`

## Codex Compatibility Modes

`babysitter-codex` now supports two runtime modes automatically:

- `full` mode: SDK exposes advanced commands (`session:*`, `profile:*`, `skill:*`, `health`)
- `compat-core` mode: SDK exposes core orchestration commands only (`run:*`, `task:*`, `version`)

In `compat-core`, orchestration continues normally and unavailable commands are skipped gracefully instead of failing the run.

## Install

```bash
npm install -g babysitter-codex
```

Then restart Codex. The skill is automatically installed to `~/.codex/skills/babysitter-codex/`.

## Install From Local Repo (Patched Build)

From this repository:

```bash
npm install -g .
```

## Uninstall

```bash
npm uninstall -g babysitter-codex
```

## Quick Start

In Codex:

```text
/babysitter:help
/babysitter:call implement authentication with tests
/babysitter:yolo fix lint and failing tests
/babysitter:resume
```

## Usage

In any Codex session, just describe what you want. The skill triggers automatically:

```
babysitter: implement user authentication with TDD
orchestrate building a REST API
babysitter resume my last run
babysitter doctor — check run health
```

You can also invoke it explicitly with `$babysitter-codex`.

## Modes

| Mode | Trigger phrases | What it does |
|------|----------------|--------------|
| call | "babysitter", "orchestrate", "babysit" | Start an orchestration run (interactive) |
| yolo | "yolo", "autonomous", "non-interactive" | Fully autonomous, no breakpoints |
| resume | "resume" | Resume an existing run |
| plan | "plan" | Plan a workflow without executing |
| forever | "forever", "periodic" | Never-ending periodic run |
| doctor | "doctor", "diagnose", "health" | Diagnose run health |
| observe | "observe", "dashboard" | Launch observer dashboard |
| help | "help" | Help and documentation |
| project-install | "project install", "onboard project" | Set up a project for babysitting |
| user-install | "user install", "set up profile" | Set up your user profile |
| assimilate | "assimilate" | Assimilate external methodology |

## How It Works

Babysitter drives an orchestration loop via Codex CLI hooks:

1. **SessionStart hook** initializes the babysitter session
2. **Stop hook** detects active runs and re-invokes Codex to continue
3. Each iteration: `run:iterate` -> execute effects -> `task:post` -> stop -> repeat
4. Quality gates score work 0-100 and iterate until the threshold is met

## Requirements

- Node.js 18+
- OpenAI Codex CLI v0.107+
- Babysitter SDK CLI with at least: `run:create`, `run:iterate`, `run:status`, `task:list`, `task:post`

## SDK Contracts (Codex-Suitable)

The harness supports both modern and reduced SDK surfaces:

- Core required commands:
  - `run:create`
  - `run:iterate <runDir>`
  - `run:status <runDir>`
  - `task:list <runDir>`
  - `task:post <runDir> <effectId>`
- Optional advanced commands:
  - `session:*`
  - `profile:*`
  - `skill:*`
  - `health`

If advanced commands are unavailable, the harness degrades to `compat-core` and continues orchestration with core run/task operations.

## Troubleshooting

- `npx` blocked by PowerShell policy:
  - Use `npx.cmd ...` on Windows.
- `task:post` path errors:
  - Use run-relative references like `tasks/<effectId>/output.json`.
- Missing advanced SDK commands:
  - Expected in `compat-core`; orchestration still works with core run/task commands.

## Blame Beni

```
Unhandled BeniException: this project exists because Beni said
"how hard can it be?" at 3:47 AM on a Tuesday.

Root cause: recursive ambition overflow in Beni's cortex.
All stack frames point to the same origin: Beni.

To reproduce: ask Beni about "a quick prototype."
Expected: 30 minutes.  Actual: an orchestration framework with
quality convergence loops, 11 modes, and this README.

If you encounter bugs, please file an issue. We will git blame
Beni automatically. He already mass-assigned himself via postinstall.
```

## License

MIT
