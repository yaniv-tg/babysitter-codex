---
name: babysitter-codex
description: >-
  Babysitter orchestration plugin for OpenAI Codex CLI. Provides structured
  multi-step AI workflows with quality convergence, lifecycle hooks, and 11
  slash commands (/babysitter:call, :yolo, :resume, :plan, :forever, :doctor,
  :observe, :help, :project-install, :user-install, :assimilate). Use when the
  user wants to orchestrate complex tasks, run quality-gated development loops,
  or manage babysitter workflows from within Codex.
---

# Babysitter for Codex CLI

Orchestrate complex, multi-step workflows with event-sourced state management,
hook-based extensibility, and human-in-the-loop approval gates.

## Slash Command Recognition

When the user types a message starting with `/babysitter:` or `/babysitter`,
this is a **slash command**. Load the corresponding SKILL.md and follow its
instructions.

### Available Commands

| Command | Description |
|---------|-------------|
| `/babysitter:call` | Start an orchestration run (interactive) |
| `/babysitter:yolo` | Start a run (non-interactive, no breakpoints) |
| `/babysitter:resume` | Resume an existing run |
| `/babysitter:plan` | Plan a workflow without executing |
| `/babysitter:forever` | Start a never-ending periodic run |
| `/babysitter:doctor` | Diagnose run health (10 checks) |
| `/babysitter:observe` | Launch observer dashboard |
| `/babysitter:help` | Help and documentation |
| `/babysitter:project-install` | Onboard a project |
| `/babysitter:user-install` | Set up user profile |
| `/babysitter:assimilate` | Assimilate external methodology |

### Aliases

- `/babysitter` = `/babysitter:call`
- `/babysitter:babysit` = `/babysitter:call`

## How to Dispatch Commands

Skill files live at `.codex/skills/babysitter/<command>/SKILL.md` relative to
the installed skill directory. Use the `skill-loader.js` module to resolve
commands:

```javascript
const { resolveCommand, getSkillContent } = require('./skill-loader');
const cmd = resolveCommand(userInput);
if (cmd) {
  const instructions = getSkillContent(cmd.command);
  // Follow the instructions in the SKILL.md
}
```

## SDK CLI Reference

The babysitter SDK CLI (`babysitter` or `npx @a5c-ai/babysitter-sdk`) provides
all orchestration commands:

- `babysitter run:create` -- Create a new orchestration run
- `babysitter run:iterate` -- Execute one orchestration step
- `babysitter run:status` -- Check run status
- `babysitter task:list` -- List pending tasks
- `babysitter task:post` -- Post task results
- `babysitter session:init` -- Initialize session
- `babysitter session:associate` -- Bind session to run
- `babysitter profile:read` -- Read user/project profile
- `babysitter health` -- Health check

## Result Posting Protocol

1. Write result value to `tasks/<effectId>/output.json`
2. Post: `babysitter task:post <runDir> <effectId> --status ok --value tasks/<effectId>/output.json`

Never write `result.json` directly -- the SDK owns that file.

## Hook-Driven Orchestration

The orchestration loop is driven by hooks:
- **SessionStart**: Initializes the babysitter session
- **Stop**: Checks for active runs, blocks premature exit during orchestration

After each effect is posted, stop the session. The stop hook will re-invoke
Codex to continue the next iteration.
