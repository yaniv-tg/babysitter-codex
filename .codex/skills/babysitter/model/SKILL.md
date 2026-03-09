---
name: babysitter:model
description: Set or view model routing policy for plan/execute/review phases.
argument-hint: "[show|set <phase>=<model> ...]"
---

# babysitter:model

Manage model routing policy used by babysitter orchestration.

## Behavior

1. If argument is `show` or empty:
   - Read `BABYSITTER_MODEL_POLICY_JSON`.
   - Return current policy JSON and effective defaults.
2. If argument starts with `set`:
   - Parse one or more `phase=model` pairs.
   - Valid phases: `plan`, `execute`, `review`, `fix`.
   - Update `BABYSITTER_MODEL_POLICY_JSON` payload.
   - Confirm the new policy map.

## Output Contract

- Always return valid JSON:
  - `action`: `show` or `set`
  - `policy`: object
  - `applied`: boolean
  - `notes`: array
