# Project-Scoped Agent Instructions — Codex v0.107.0

These instructions supplement the root-level `AGENTS.md` with project-specific conventions
for SDK CLI usage, directory structure, and task result formatting.

---

## 1. SDK CLI Usage Reference

The following babysitter SDK CLI commands are available in this environment:

### Posting a task result

```bash
npx -y @a5c-ai/babysitter-sdk@0.0.173 task:post <runDir> <effectId> --status ok --value <outputPath> --json
```

### Posting a task error

```bash
npx -y @a5c-ai/babysitter-sdk@0.0.173 task:post <runDir> <effectId> --status error --error <errorPath> --json
```

### Listing tasks for a run

```bash
npx -y @a5c-ai/babysitter-sdk@0.0.173 task:list --run-id <RUN_ID> --json
```

### Checking run status

```bash
npx -y @a5c-ai/babysitter-sdk@0.0.173 run:status --run-id <RUN_ID> --json
```

### Creating a run

```bash
npx -y @a5c-ai/babysitter-sdk@0.0.173 run:create --json --process-id <PROCESS_ID>
```

### Iterating a run

```bash
npx -y @a5c-ai/babysitter-sdk@0.0.173 run:iterate <runDir> --json --iteration <N>
```

### Initializing a session

```bash
npx -y @a5c-ai/babysitter-sdk@0.0.173 session:init --json
```

### Checking agent/SDK version

```bash
codex --version
```

### Environment variables honored by the CLI

| Variable                  | Purpose                                              |
|---------------------------|------------------------------------------------------|
| `CODEX_RUN_ID`            | Active run ID (set by wrapper automatically)         |
| `CODEX_TASK_ID`           | Active task ID (set by wrapper automatically)        |
| `CODEX_ROOT`              | Repo root override (defaults to `$PWD`)              |
| `CODEX_OUTPUT_DIR`        | Override for output directory (rarely needed)        |
| `CODEX_LOG_LEVEL`         | Logging verbosity: `debug`, `info`, `warn`, `error`  |

---

## 2. `.a5c/` Directory Structure Conventions

The `.a5c/` directory is the babysitter orchestration state directory. Follow these rules:

### Do
- Read task definitions from `.a5c/runs/<RUN_ID>/tasks/<TASK_ID>/task.json`.
- Write results to `.a5c/runs/<RUN_ID>/tasks/<TASK_ID>/output.json`.
- Use `.a5c/runs/<RUN_ID>/manifest.json` as a read-only reference for run configuration.

### Do Not
- Modify `manifest.json` — it is owned by the wrapper.
- Delete any file under `.a5c/` — the wrapper uses these for audit and retry logic.
- Create files under `.a5c/` other than `output.json` in the designated task directory.

### Typical `.a5c/` layout

```
.a5c/
  runs/
    01KJXAQWD61XZ5Y3HR38AK5ANV/
      manifest.json
      tasks/
        01KJXC5JM7S937H3TC4FASHWAP/
          task.json
          output.json          ← written by agent after completion
        01KJXC5JM7S937H3TC4FASHWAQ/
          task.json
          output.json
```

File names use **ULID** format for run IDs and task IDs (26-character sortable identifiers).

---

## 3. Task Result Posting Format

Every `output.json` written by this agent must follow this envelope:

```json
{
  "success": true | false,
  "taskId": "<TASK_ID>",
  "completedAt": "<ISO-8601 datetime with timezone, e.g. 2026-03-04T12:00:00Z>",
  "result": { }
}
```

The `result` object must match the `outputSchema` declared in `task.json`. Common schemas:

### File creation result

```json
{
  "success": true,
  "taskId": "01KJXC5JM7S937H3TC4FASHWAP",
  "completedAt": "2026-03-04T12:00:00Z",
  "result": {
    "filesCreated": ["path/to/file1", "path/to/file2"],
    "agentsMdPath": "/absolute/path/to/AGENTS.md"
  }
}
```

### Shell command result

```json
{
  "success": true,
  "taskId": "01KJXC5JM7S937H3TC4FASHWAP",
  "completedAt": "2026-03-04T12:00:00Z",
  "result": {
    "exitCode": 0,
    "stdout": "...",
    "stderr": ""
  }
}
```

### Error result

```json
{
  "success": false,
  "taskId": "01KJXC5JM7S937H3TC4FASHWAP",
  "completedAt": "2026-03-04T12:00:00Z",
  "error": {
    "code": "SHELL_NONZERO_EXIT",
    "message": "Command exited with code 1",
    "detail": "stderr output here",
    "effectType": "shell"
  }
}
```

---

## 4. Notes on This Project

- Repository root: `/data/repos`
- Node modules are present (`node_modules/`, `package.json`); npm scripts may be available.
- The `projects/` subdirectory may contain sub-projects with their own conventions.
- Always operate from the repository root unless a task explicitly specifies a working directory.
