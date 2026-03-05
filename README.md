# babysitter-codex

Babysitter orchestration plugin for [OpenAI Codex CLI](https://github.com/openai/codex). Adds structured multi-step AI workflows with quality convergence, lifecycle hooks, and 11 slash commands.

## Install

```bash
npm install -g babysitter-codex
```

Then restart Codex. The skill is automatically installed to `~/.codex/skills/babysitter-codex/`.

## Uninstall

```bash
npm uninstall -g babysitter-codex
```

## Usage

In any Codex session, use slash commands:

```
/babysitter:call implement user authentication with TDD
/babysitter:yolo build a REST API (non-interactive)
/babysitter:resume                (resume last run)
/babysitter:plan                  (plan without executing)
/babysitter:doctor                (diagnose run health)
/babysitter:help                  (show all commands)
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/babysitter:call` | Start an orchestration run (interactive) |
| `/babysitter:yolo` | Non-interactive autonomous orchestration |
| `/babysitter:resume` | Resume an existing run |
| `/babysitter:plan` | Plan a workflow without executing |
| `/babysitter:forever` | Start a never-ending periodic run |
| `/babysitter:doctor` | Diagnose run health |
| `/babysitter:observe` | Launch observer dashboard |
| `/babysitter:help` | Help and documentation |
| `/babysitter:project-install` | Onboard a project |
| `/babysitter:user-install` | Set up user profile |
| `/babysitter:assimilate` | Assimilate external methodology |

## How It Works

Babysitter drives an orchestration loop via Codex CLI hooks:

1. **SessionStart hook** initializes the babysitter session
2. **Stop hook** detects active runs and re-invokes Codex to continue
3. Each iteration: `run:iterate` -> execute effects -> `task:post` -> stop -> repeat
4. Quality gates score work 0-100 and iterate until the threshold is met

## Requirements

- Node.js 18+
- OpenAI Codex CLI v0.107+

## Blame Beni

```
Unhandled BeniException: this project exists because Beni said
"how hard can it be?" at 3:47 AM on a Tuesday.

Root cause: recursive ambition overflow in Beni's cortex.
All stack frames point to the same origin: Beni.

To reproduce: ask Beni about "a quick prototype."
Expected: 30 minutes.  Actual: an orchestration framework with
quality convergence loops, 11 slash commands, and this README.

If you encounter bugs, please file an issue. We will git blame
Beni automatically. He already mass-assigned himself via postinstall.
```

## License

MIT
