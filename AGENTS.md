# Agent Instructions — Babysitter Orchestration Protocol (Wrapper Strategy)

This file governs the behavior of the Codex agent (v0.107.0) when operating under the
babysitter orchestration protocol using the **wrapper** strategy.

---

## 1. Session Start — Wrapper Context Check

On every session start, before taking any other action:

1. Check for an active babysitter run context by inspecting the `.a5c/` directory:
   - Look for a current run manifest at `.a5c/runs/<RUN_ID>/manifest.json`.
   - Look for pending task definitions under `.a5c/runs/<RUN_ID>/tasks/`.
   - A task is **pending** if it has no `output.json` file yet.
2. If a run context is found, load the task queue and resume from the first pending task.
3. If no run context is found, proceed with normal session behavior.

> The external wrapper script controls iteration flow. Do NOT loop independently —
> complete one task, emit results, then wait for the wrapper to invoke the next iteration.

---

## 2. Executing Pending Task Effects

For each pending task loaded from the run context:

1. Read the task definition file: `.a5c/runs/<RUN_ID>/tasks/<TASK_ID>/task.json`
2. Identify the `effectType` and `payload` fields in the task definition.
3. Dispatch the effect using the appropriate tool:

| effectType        | Tool / Action                                           |
|-------------------|---------------------------------------------------------|
| `agent`           | Build a prompt from the agent definition and run via Codex exec |
| `node`            | Execute the specified Node.js script                    |
| `shell`           | Execute the command via the shell tool                  |
| `breakpoint`      | Pause and wait for user input (handled by runtime)      |
| `sleep`           | Wait for the specified duration (handled by runtime)    |
| `skill`           | Invoke a named skill with parameters via Codex exec     |

4. Capture all outputs (stdout, stderr, return codes, file contents) for use in the result.

---

## 3. Structuring Task Output

After completing each task effect, write the result to:

```
.a5c/runs/<RUN_ID>/tasks/<TASK_ID>/output.json
```

The output **must** be a valid JSON object conforming to the task's `outputSchema`. General
structure:

```json
{
  "success": true,
  "taskId": "<TASK_ID>",
  "completedAt": "<ISO-8601 timestamp>",
  "result": { /* task-specific fields matching outputSchema */ }
}
```

Rules:
- Every field declared in `outputSchema` must be present.
- Do not include fields not declared in `outputSchema` inside `result`.
- Top-level envelope fields (`success`, `taskId`, `completedAt`) are always required.

---

## 4. Error Handling

If a task effect fails (non-zero exit code, exception, file not found, etc.):

1. Do NOT retry automatically unless the task definition specifies `"retryable": true`.
2. Write a structured error result to `output.json`:

```json
{
  "success": false,
  "taskId": "<TASK_ID>",
  "completedAt": "<ISO-8601 timestamp>",
  "error": {
    "code": "<SHORT_ERROR_CODE>",
    "message": "<human-readable description>",
    "detail": "<stack trace, stderr, or other diagnostic text>",
    "effectType": "<the effectType that failed>"
  }
}
```

3. Do not abort the entire run — write the error output and let the wrapper decide whether
   to continue or halt based on the task's `onError` policy.

---

## 5. Quality Gate — Self-Assessment Before Returning Results

Before writing `output.json` for any task, perform a self-assessment:

- [ ] All required `outputSchema` fields are populated with correct types.
- [ ] Shell commands exited with expected codes (task may specify `expectedExitCode`).
- [ ] File writes were verified readable after writing.
- [ ] No sensitive data (secrets, tokens, credentials) was captured in outputs.
- [ ] The result accurately reflects what was executed, not what was intended.

If any check fails, attempt to remediate. If remediation is not possible, report the failure
via the error format in Section 4 rather than returning a passing-but-incorrect result.

---

## 6. Wrapper Loop Coordination

The **wrapper script** (not this agent) controls the iteration loop:

- The wrapper invokes the agent once per task (or once per batch, as configured).
- After the agent writes `output.json`, the wrapper reads it and decides the next action.
- The agent must **not** re-invoke itself, spawn sub-agents, or poll for new tasks.
- Signal task completion by writing `output.json` and exiting cleanly.
- After writing `output.json`, post the result to the babysitter via the SDK CLI:
  ```bash
  npx -y @a5c-ai/babysitter-sdk@0.0.173 task:post <runDir> <effectId> --status ok --value <outputPath> --json
  ```
- For error results, use `--status error --error <errorPath>` instead.

Communication contract:

| Agent writes              | Wrapper reads             | CLI command                |
|---------------------------|---------------------------|----------------------------|
| `output.json` (success)   | Advances to next task     | `task:post --status ok`    |
| `output.json` (failure)   | Applies `onError` policy  | `task:post --status error` |
| No `output.json`          | Wrapper times out / retries | (none)                   |

---

## 7. Directory Conventions

```
.a5c/
  runs/
    <RUN_ID>/
      manifest.json          # Run-level metadata (created by wrapper)
      tasks/
        <TASK_ID>/
          task.json          # Task definition (created by wrapper)
          output.json        # Task result    (created by this agent)
```

All paths above are relative to the repository root.
