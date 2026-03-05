# babysitter-codex

Integrate [Babysitter SDK](https://www.npmjs.com/package/@a5c-ai/babysitter-sdk) orchestration into [OpenAI Codex CLI](https://github.com/openai/codex), enabling structured, multi-step task execution with quality convergence loops, runaway detection, and full lifecycle management.

## What is this?

This project bridges two powerful tools:

- **Codex CLI** — OpenAI's CLI agent that can execute code, edit files, and run shell commands autonomously via `codex exec --full-auto`
- **Babysitter SDK** — An orchestration framework that breaks complex workflows into structured tasks with quality gates, breakpoints, and convergence loops

Together, they enable **orchestrated AI workflows** where Codex executes individual tasks while Babysitter manages the overall process — tracking progress, enforcing iteration limits, posting results, and converging on quality targets.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       Orchestration Layer                        │
│                                                                  │
│  loop-control.sh / orchestrate.js                                │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Session   │  │ Run Create   │  │ Iteration    │              │
│  │ Manager   │→ │ & Bind       │→ │ Loop         │              │
│  └───────────┘  └──────────────┘  └──────┬───────┘              │
│                                          │                      │
│        ┌─────────────────────────────────┤                      │
│        ▼                                 ▼                      │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │ Effect Mapper        │  │ Iteration Guards     │             │
│  │ agent|node|shell|    │  │ iteration|time|      │             │
│  │ breakpoint|sleep|    │  │ cost|stall           │             │
│  │ skill|hook|parallel| │  └──────────────────────┘             │
│  │ orchestrator_task    │                                        │
│  └──────────┬───────────┘                                        │
│             │                                                    │
│  ┌──────────▼───────────┐  ┌──────────────────────┐             │
│  │ Hook Dispatcher      │  │ Profile Manager      │             │
│  │ 13 hook types        │  │ user/project scopes  │             │
│  └──────────────────────┘  └──────────────────────┘             │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │ Discovery            │  │ Health Check         │             │
│  │ skill:discover +     │  │ health + configure   │             │
│  │ @skill/@agent JSDoc  │  └──────────────────────┘             │
│  └──────────────────────┘                                        │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │ codex exec           │  │ Result Poster        │             │
│  │ --full-auto          │→ │ task:post + retry    │             │
│  └──────────────────────┘  └──────────────────────┘             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Babysitter SDK CLI                                       │    │
│  │ session:init | run:create | run:iterate                  │    │
│  │ task:post | run:status                                   │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites

- **Node.js** >= 18
- **[OpenAI Codex CLI](https://github.com/openai/codex)** — `npm i -g @openai/codex`
- **OpenAI API key** — set `OPENAI_API_KEY` in your environment
- **[Babysitter SDK](https://www.npmjs.com/package/@a5c-ai/babysitter-sdk)** — installed automatically as a dependency

### Quick Install

```bash
# Clone the repo
git clone https://github.com/yaniv-tg/babysitter-codex.git
cd babysitter-codex

# Install dependencies (includes babysitter SDK)
npm install

# Verify everything works
npm test
```

### Add to an Existing Project

```bash
# Copy the harness into your project
cp -r babysitter-codex/.codex /path/to/your/project/.codex
cp babysitter-codex/AGENTS.md /path/to/your/project/AGENTS.md

# Install the SDK dependency
cd /path/to/your/project
npm install @a5c-ai/babysitter-sdk

# Run the health check
npx babysitter health --json
```

### Global SDK Installation (Optional)

```bash
npm install -g @a5c-ai/babysitter-sdk
babysitter health --json
```

### Usage

#### Strategy A: Shell Wrapper (Recommended for CI/production)

```bash
.codex/hooks/loop-control.sh \
  "my-process-id" \
  "./my-process.js#process" \
  "Build a REST API with user authentication" \
  10  # max iterations
```

The wrapper script will:
1. Initialize a babysitter session
2. Create a run bound to the process
3. Loop: execute `codex exec --full-auto` for each task
4. Post results back to babysitter
5. Check for completion or enforce iteration guards

#### Strategy B: Node.js Orchestrator (Recommended for interactive use)

```bash
node .codex/orchestrate.js \
  --process-id "my-process" \
  --entry "./my-process.js#process" \
  --prompt "Implement a todo app with React" \
  --max-iterations 10
```

#### Strategy C: MCP Server (In-session orchestration)

Codex can call babysitter tools directly via the configured MCP server:

```bash
codex --full-auto "Follow the babysitter orchestration protocol in AGENTS.md"
```

## Project Structure

```
.
├── AGENTS.md                          # Root agent instructions for Codex
├── package.json                       # Project config with orchestration scripts
├── test/
│   ├── integration.test.js            # Syntax validation + module resolution tests
│   └── harness.test.js                # Unit tests for all harness components
├── .codex/
│   ├── AGENTS.md                      # Project-scoped SDK CLI reference
│   ├── config.toml                    # MCP server + sandbox configuration
│   ├── orchestrate.js                 # Node.js orchestration wrapper
│   ├── effect-mapper.js               # Maps 9 effect kinds → Codex prompts
│   ├── result-poster.js               # Result posting with retry + blob handling
│   ├── iteration-guard.js             # 4-guard runaway detection module
│   ├── hook-dispatcher.js             # Routes events to 13 hook types
│   ├── profile-manager.js             # User/project profile CRUD + render
│   ├── discovery.js                   # skill:discover + @skill/@agent marker parser
│   ├── session-manager.js             # Full session lifecycle (8 commands)
│   ├── health-check.js                # SDK health + configure diagnostics
│   └── hooks/
│       ├── utils.js                   # Shared utilities (getRunId, isValidRunId, etc.)
│       ├── session-init.js            # Session initialization hook
│       ├── on-turn-complete.js        # Turn completion logger + status check
│       ├── iteration-guard.js         # Hook entry point (delegates to standalone)
│       ├── loop-control.sh            # POSIX shell orchestration wrapper
│       ├── build-task-payload.js      # Safe JSON payload builder
│       ├── write-json.js              # Atomic JSON file writer
│       ├── read-json.js               # Safe JSON field extractor
│       ├── on-run-start/logger.js
│       ├── on-run-complete/logger.js
│       ├── on-run-fail/logger.js
│       ├── on-task-start/logger.js
│       ├── on-task-complete/logger.js
│       ├── on-iteration-start/logger.js
│       ├── on-iteration-end/logger.js
│       ├── on-breakpoint/handler.js
│       ├── on-score/logger.js
│       ├── pre-commit/
│       ├── pre-branch/
│       ├── post-planning/
│       └── on-step-dispatch/
└── .a5c/
    └── runs/                          # Babysitter run state (gitignored)
```

## Components

### Effect Mapper (`effect-mapper.js`)

Maps babysitter task effect kinds to Codex execution:

| Effect Kind | Codex Action |
|-------------|-------------|
| `agent` | Builds prompt from role/task/instructions, runs `codex exec` |
| `node` | Executes Node.js script via shell |
| `shell` | Runs shell command directly |
| `breakpoint` | Pauses for human approval (interactive) or auto-resolves |
| `sleep` | Waits until timestamp |
| `skill` | Builds prompt from skill context |
| `hook` | Fires named hook via dispatcher |
| `parallel` | Groups effects for concurrent execution |
| `orchestrator_task` | Delegates sub-orchestration decisions |

### Iteration Guards (`iteration-guard.js`)

Four independent guards running in parallel to prevent runaway execution:

| Guard | What it checks | Default |
|-------|---------------|---------|
| **Iteration** | Loop count vs max | 10 iterations |
| **Time** | Elapsed time vs timeout | 1 hour |
| **Cost** | Projected token usage vs budget | Configurable |
| **Stall** | Quality score plateau detection | 3 consecutive stalls |

### Hook System (`hook-dispatcher.js`)

Routes lifecycle events to the babysitter `hook:log` CLI and any custom handler scripts in `.codex/hooks/<hookType>/*.js`. Handlers can be sync or async; failures are logged to stderr without aborting the run.

| Hook Type | When it fires |
|-----------|--------------|
| `on-run-start` | A new run is created and begins executing |
| `on-run-complete` | A run finishes successfully |
| `on-run-fail` | A run terminates with an error |
| `on-task-start` | A task begins execution |
| `on-task-complete` | A task finishes and posts its result |
| `on-step-dispatch` | An individual step is dispatched within a task |
| `on-iteration-start` | An iteration loop begins |
| `on-iteration-end` | An iteration loop ends |
| `on-breakpoint` | A breakpoint is encountered, waiting for approval |
| `pre-commit` | Before a git commit is made |
| `pre-branch` | Before a git branch is created |
| `post-planning` | After the planning phase completes |
| `on-score` | A quality score is recorded |

Usage:

```javascript
const { fireHook } = require('./.codex/hook-dispatcher');
fireHook('on-task-start', { taskId: '...', title: 'Analyze requirements' });
```

### Profile System (`profile-manager.js`)

Manages user-level and project-level profiles via the babysitter CLI. All functions call `babysitter profile:<subcommand> --user|--project`.

| Function | CLI Command | Description |
|----------|------------|-------------|
| `readUserProfile()` | `profile:read --user --json` | Read the user-level profile |
| `readProjectProfile(dir)` | `profile:read --project --json` | Read the project-level profile |
| `writeUserProfile(data)` | `profile:write --user --input <file> --json` | Replace the user-level profile |
| `writeProjectProfile(data, dir)` | `profile:write --project --input <file> --json` | Replace the project-level profile |
| `mergeUserProfile(data)` | `profile:merge --user --input <file> --json` | Patch the user-level profile |
| `mergeProjectProfile(data, dir)` | `profile:merge --project --input <file> --json` | Patch the project-level profile |
| `renderUserProfile()` | `profile:render --user` | Render user profile as markdown |
| `renderProjectProfile(dir)` | `profile:render --project` | Render project profile as markdown |

Profiles are returned as parsed JSON objects. `null` is returned when no profile exists (the CLI reports `no_profile`). Use `--dir <dir>` to override the project directory.

### Discovery (`discovery.js`)

Discovers available skills, agents, and processes via the babysitter `skill:discover` CLI, and parses `@skill`/`@agent` JSDoc markers directly from process source files.

**`discoverSkills(options)`** — Calls `babysitter skill:discover --json` with optional flags:

| Option | CLI Flag | Description |
|--------|---------|-------------|
| `pluginRoot` | `--plugin-root` | Plugin root directory |
| `runsDir` | `--runs-dir` | Runs directory |
| `cacheTtl` | `--cache-ttl` | Cache TTL in seconds |
| `includeRemote` | `--include-remote` | Include remote skill sources |
| `summaryOnly` | `--summary-only` | Return a summary only |
| `processPath` | `--process-path` | Scope discovery to a specific process file |

**`fetchRemoteSkills(sourceType, url)`** — Fetches skills from a remote `github` or `well-known` source.

**`parseProcessMarkers(filePath)`** — Scans a process JS file for JSDoc markers and returns `{ skills, agents }` arrays. Supported marker forms:

```javascript
/** @skill mySkillName ./path/to/skill */
// @agent myAgentName ./agents/myAgent
```

Paths in markers are resolved relative to the containing file.

### Session Management (`session-manager.js`)

Full session lifecycle management wrapping all 8 babysitter session CLI commands.

| Function | CLI Command | Description |
|----------|------------|-------------|
| `initSession({ sessionId, stateDir })` | `session:init` | Initialize a new session |
| `associateSession(runId)` | `session:associate` | Associate session with a run ID |
| `resumeSession(sessionId, runId, { runsDir })` | `session:resume` | Resume an existing session |
| `getSessionState()` | `session:state` | Get current session state |
| `updateSession({ iteration, lastIterationAt })` | `session:update` | Update iteration counter or timestamp |
| `checkIteration()` | `session:check-iteration` | Check current iteration status |
| `getIterationMessage(iteration, runId, { runsDir, pluginRoot })` | `session:iteration-message` | Get message for a specific iteration |
| `getLastMessage(transcriptPath)` | `session:last-message` | Get last message from a transcript file |

All functions return parsed JSON and throw descriptive errors on failure.

### Health & Diagnostics (`health-check.js`)

Provides SDK health checks and configuration diagnostics.

| Function | CLI Command | Description |
|----------|------------|-------------|
| `checkHealth(verbose)` | `health --json` | Run SDK health check; returns `{ status, ... }` |
| `showConfig()` | `configure show --json` | Show current effective configuration |
| `validateConfig()` | `configure validate --json` | Validate config; returns `{ valid, errors, warnings }` |
| `showPaths()` | `configure paths --json` | Show all important SDK paths |
| `runStartupHealthGate(verbose)` | `health --json` | Returns `true` if healthy/degraded, `false` if unhealthy |

Integrate `runStartupHealthGate()` at orchestrator startup to fail fast on misconfigured environments.

### Result Poster (`result-poster.js`)

- Posts task results to babysitter via `task:post` CLI
- Retry with exponential backoff (3 attempts: 500ms, 1s, 2s)
- Large result handling: files > 1 MiB are offloaded to `blobs/`
- Input validation against output schemas

### MCP Server Configuration (`config.toml`)

Registers babysitter as an MCP server so Codex can call orchestration tools directly:

```toml
[mcp_servers.babysitter]
command = "npx"
args = ["-y", "@a5c-ai/babysitter-sdk@0.0.173", "mcp-server"]

[mcp_servers.babysitter.env]
BABYSITTER_RUNS_DIR = ".a5c/runs"
```

### Testing

The test suite lives in `test/` and covers syntax validation, module resolution, and harness unit tests.

```bash
# Run all tests
npm test

# Run only integration tests (syntax + module resolution)
node test/integration.test.js

# Run only harness unit tests (effect mapper, guards, hooks, etc.)
node test/harness.test.js
```

`test/integration.test.js` checks that all `.js` files in `.codex/` pass `node --check` and can be `require()`d without errors.

`test/harness.test.js` exercises all 9 effect kinds, iteration guards, hook dispatcher, profile manager, discovery, session manager, and health check functions.

### Observer Dashboard

Launch the built-in run observer to monitor live orchestration state:

```bash
npm run observe
# or directly:
npx @a5c-ai/babysitter-sdk@0.0.173 observe --runs-dir .a5c/runs
```

The dashboard shows active runs, iteration progress, task statuses, quality scores, and guard states in real time.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BABYSITTER_MAX_ITERATIONS` | Maximum loop iterations | `10` |
| `BABYSITTER_TIMEOUT` | Time limit in ms | `3600000` (1hr) |
| `BABYSITTER_MAX_COST` | Token budget threshold | unlimited |
| `BABYSITTER_RUN_ID` | Override run ID | auto-detected |
| `BABYSITTER_SESSION_ID` | Override session ID | auto-detected |
| `BABYSITTER_RUNS_DIR` | Directory for run state files | `.a5c/runs` |
| `BABYSITTER_PLUGIN_ROOT` | Plugin root for skill discovery | auto-detected |
| `REPO_ROOT` | Project root directory | auto-detected |

### npm Scripts

```bash
npm run orchestrate        # Run the Node.js orchestrator
npm run loop-control       # Run the shell wrapper
npm test                   # Run all tests (integration + harness)
npm run lint               # Syntax-check all .codex JS files
```

Additional scripts (run directly via npx):

```bash
# Run unit tests only
node test/harness.test.js

# Run integration tests only
node test/integration.test.js

# Health check
npx @a5c-ai/babysitter-sdk@0.0.173 health --json

# Discover available skills
npx @a5c-ai/babysitter-sdk@0.0.173 skill:discover --json --runs-dir .a5c/runs

# Launch observer dashboard
npx @a5c-ai/babysitter-sdk@0.0.173 observe --runs-dir .a5c/runs

# Show effective configuration
npx @a5c-ai/babysitter-sdk@0.0.173 configure show --json
```

## How It Works

1. **Session Init** — Establishes a babysitter session, stores session ID
2. **Run Create** — Creates a babysitter run bound to a process definition
3. **Iterate** — Calls `run:iterate` to get pending tasks from the process
4. **Execute** — For each task, builds a Codex prompt via the effect mapper and runs `codex exec --full-auto`
5. **Post Results** — Sends task results back to babysitter via `task:post`
6. **Guard Check** — Runs all 4 iteration guards to prevent runaway execution
7. **Repeat** — Continues until the run completes, fails, or guards halt execution

## Writing Process Definitions

Babysitter processes are JavaScript files that define task flows:

```javascript
import { defineTask } from '@a5c-ai/babysitter-sdk';

export async function process(inputs, ctx) {
  // Phase 1: Analysis
  const analysis = await ctx.task(analyzeTask, { scope: inputs.scope });

  // Breakpoint: human review
  await ctx.breakpoint({ question: 'Proceed with implementation?' });

  // Phase 2: Implementation (parallel tasks)
  const [frontend, backend] = await ctx.parallel.all([
    async () => ctx.task(buildFrontendTask, { spec: analysis.spec }),
    async () => ctx.task(buildBackendTask, { spec: analysis.spec }),
  ]);

  // Phase 3: Quality convergence loop
  let quality = 0;
  while (quality < inputs.targetQuality) {
    const test = await ctx.task(testTask, { frontend, backend });
    quality = test.score;
    if (quality < inputs.targetQuality) {
      await ctx.task(refineTask, { feedback: test.feedback });
    }
  }

  return { success: true, quality };
}

export const analyzeTask = defineTask('analyze', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Analyze requirements',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'software architect',
      task: 'Analyze the project requirements',
      context: args,
      instructions: ['Review scope', 'Identify components', 'Create spec'],
      outputFormat: 'JSON with spec, components, milestones'
    }
  }
}));
```

## Q&A

**Q: What is the difference between the shell wrapper and the Node.js orchestrator?**
The shell wrapper (`loop-control.sh`) is a self-contained POSIX script ideal for CI/CD pipelines and headless environments. The Node.js orchestrator (`orchestrate.js`) integrates all harness modules (hooks, profiles, discovery, health checks) and is better for interactive development with richer error handling and session management.

**Q: Can I use this without the Babysitter SDK?**
No. The SDK is the orchestration engine — it manages runs, tasks, journals, and state. This harness is the bridge that lets Codex CLI act as the task executor within that orchestration framework.

**Q: How do I write a custom process?**
See the [Writing Process Definitions](#writing-process-definitions) section. Processes are JavaScript files that define task flows using `defineTask` and `ctx.task()` / `ctx.parallel.all()` / `ctx.breakpoint()`. Check `.a5c/processes/` for examples.

**Q: What happens if Codex crashes mid-run?**
The harness uses PID-based run locking with stale lock detection. If a process crashes, the next run attempt will detect the stale lock (dead PID), warn you, and safely take over. All task results already posted to the journal are preserved.

**Q: How do I monitor a running orchestration?**
Launch the observer dashboard: `npm run observe`. It shows real-time task progress, quality scores, journal events, and guard states in your browser.

**Q: What are breakpoints?**
Breakpoints are human approval gates in the process. When a breakpoint is reached, the orchestration pauses and waits for explicit approval before continuing. They're used before destructive operations, architecture decisions, or deployment steps.

**Q: How do I customize iteration limits and timeouts?**
Set environment variables: `BABYSITTER_MAX_ITERATIONS=20`, `BABYSITTER_TIMEOUT=7200000` (2 hours), or `BABYSITTER_MAX_COST=50000` (token budget). See the [Configuration](#configuration) section.

**Q: Can I add custom hooks?**
Yes. Drop a `.js` file into `.codex/hooks/<hookType>/` (e.g., `.codex/hooks/on-task-complete/slack-notify.js`). The hook dispatcher auto-discovers and runs all handlers in the directory. See the [Hook System](#hook-system-hook-dispatcherjs) section for the 13 available hook types.

**Q: What SDK version does this harness target?**
This harness targets `@a5c-ai/babysitter-sdk@0.0.173+` and supports all features up to v0.0.175, including the full hook system, profile management, skill/agent discovery, session lifecycle, and health diagnostics.

## Blame Beni

Something broke? Tests failing? Quality score stuck at 99? Process won't converge? Lock file haunting you from a past life?

**Blame Beni.**

Beni is the invisible force behind every edge case, every off-by-one error, and every "works on my machine" moment. When the hook dispatcher fires into the void, when the session manager loses its identity, when the iteration guard detects a runaway loop that was actually just vibes — that's Beni's handiwork.

Known Beni-caused issues include but are not limited to:

- The SDK returning `no_profile` when a profile definitely exists (Beni deleted it)
- Stale locks from processes that were never actually running (Beni started them in a dream)
- Breakpoints that auto-approve themselves (Beni clicked "Approve" when you weren't looking)
- Quality scores that go *down* after refinement (Beni's refinement)
- The observer dashboard showing a run that completed 3 days ago as "in progress" (Beni is still thinking)
- `loop-control.sh` exiting with code 42 (the answer to everything, courtesy of Beni)
- Your git history showing commits at 4:37 AM that you don't remember making (that was Beni)

If you encounter any issue not listed above, it is also Beni's fault. File an issue and tag it `blame-beni`.

> "I didn't do it." — Beni (lying)

## Security

- **Input sanitization**: All run IDs validated against ULID format (`/^[A-Za-z0-9-]+$/`) before shell interpolation
- **Safe JSON handling**: Dedicated `write-json.js` and `read-json.js` helpers replace fragile shell printf/grep/sed patterns
- **Atomic writes**: State files written via tmp-then-rename to prevent corruption
- **No path injection**: `build-task-payload.js` receives file paths as argv arguments, never interpolated into code strings
- **Sandbox isolation**: Codex configured with `disk-write-access-.a5c` to limit filesystem writes

## License

MIT
