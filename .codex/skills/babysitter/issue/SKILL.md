---
name: babysitter:issue
description: Start a babysitter workflow from a GitHub issue.
argument-hint: "<issue-number|url> [--repo owner/name]"
---

# babysitter:issue

Run issue-driven orchestration.

## Behavior

1. Parse issue input:
   - Numeric issue id, or full GitHub issue URL.
   - Optional `--repo owner/name`.
2. Resolve repository:
   - If `--repo` omitted, infer from current git remote.
3. Fetch issue details:
   - Use `.codex/github-workflow.js` helper.
4. Generate:
   - Concise implementation plan.
   - Proposed steps and risk notes.
5. Ask for execution mode:
   - `plan` only or `apply`.
6. If `apply`:
   - Start babysitter run with issue context in prompt.

## Output Contract

- Return JSON with:
  - `issue`: metadata
  - `plan`: list of actionable steps
  - `mode`: `plan` or `apply`
  - `nextAction`: command suggestion
