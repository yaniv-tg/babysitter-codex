---
name: babysitter-codex
description: >-
  Orchestrate complex, multi-step AI workflows with quality convergence loops,
  event-sourced state, and human-in-the-loop approval gates. Use when the user
  wants to babysit a task, orchestrate a workflow, run quality-gated development,
  resume a previous orchestration run, diagnose run health, plan without executing,
  set up a project or user profile for babysitter, or assimilate an external
  methodology. Also use when the user mentions "babysitter", "orchestrate",
  "babysit", "quality loop", or "convergence loop".
---

# Babysitter for Codex CLI

Orchestrate complex, multi-step workflows with event-sourced state management,
hook-based extensibility, and human-in-the-loop approval gates.

## Choosing a Mode

Based on the user's request, read the appropriate sub-skill from
`.codex/skills/babysitter/<mode>/SKILL.md` (relative to this skill's install
directory) and follow its instructions.

| User intent | Mode | Sub-skill to read |
|-------------|------|-------------------|
| Start an orchestration run (default) | call | `call/SKILL.md` |
| Run autonomously, no interaction | yolo | `yolo/SKILL.md` |
| Resume an existing run | resume | `resume/SKILL.md` |
| Plan a workflow without executing | plan | `plan/SKILL.md` |
| Start a never-ending periodic run | forever | `forever/SKILL.md` |
| Diagnose run health | doctor | `doctor/SKILL.md` |
| Launch observer dashboard | observe | `observe/SKILL.md` |
| Help and documentation | help | `help/SKILL.md` |
| Onboard a project | project-install | `project-install/SKILL.md` |
| Set up user profile | user-install | `user-install/SKILL.md` |
| Assimilate external methodology | assimilate | `assimilate/SKILL.md` |

If unclear, default to `call/SKILL.md`.

## SDK CLI Quick Reference

The babysitter SDK CLI (`babysitter` or `npx @a5c-ai/babysitter-sdk`) drives
all orchestration:

```
babysitter run:create   --process-id <id> --entry <path>#<export> ...
babysitter run:iterate  <runDir> --json --iteration <n>
babysitter run:status   <runId> --json
babysitter task:list    <runId> --pending --json
babysitter task:post    <runId> <effectId> --status ok --value <file> --json
babysitter profile:read --user --json
babysitter health
```

## Result Posting Protocol

1. Write result value to `tasks/<effectId>/output.json`
2. Post: `babysitter task:post <runDir> <effectId> --status ok --value tasks/<effectId>/output.json`
3. Never write `result.json` directly -- the SDK owns that file.

## Hook-Driven Loop

After each effect is posted, stop the session. The stop hook re-invokes
Codex to continue the next iteration. Do not loop within a single session.
