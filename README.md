# babysitter-codex

Integrate [Babysitter SDK](https://www.npmjs.com/package/@a5c-ai/babysitter-sdk) orchestration into [OpenAI Codex CLI](https://github.com/openai/codex), enabling structured, multi-step task execution with quality convergence loops, runaway detection, and full lifecycle management.

## What is this?

This project bridges two powerful tools:

- **Codex CLI** — OpenAI's CLI agent that can execute code, edit files, and run shell commands autonomously via `codex exec --full-auto`
- **Babysitter SDK** — An orchestration framework that breaks complex workflows into structured tasks with quality gates, breakpoints, and convergence loops

Together, they enable **orchestrated AI workflows** where Codex executes individual tasks while Babysitter manages the overall process — tracking progress, enforcing iteration limits, posting results, and converging on quality targets.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Orchestration Layer                │
│                                                     │
│  loop-control.sh / orchestrate.js                   │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Session   │  │ Run Create   │  │ Iteration    │  │
│  │ Init      │→ │ & Bind       │→ │ Loop         │  │
│  └───────────┘  └──────────────┘  └──────┬───────┘  │
│                                          │          │
│                    ┌─────────────────────┤          │
│                    ▼                     ▼          │
│  ┌──────────────────────┐  ┌──────────────────┐    │
│  │ Effect Mapper        │  │ Iteration Guards │    │
│  │ agent|node|shell|    │  │ iteration|time|  │    │
│  │ breakpoint|sleep|    │  │ cost|stall       │    │
│  │ skill                │  └──────────────────┘    │
│  └──────────┬───────────┘                          │
│             ▼                                      │
│  ┌──────────────────────┐  ┌──────────────────┐    │
│  │ codex exec           │  │ Result Poster    │    │
│  │ --full-auto          │→ │ task:post + retry│    │
│  └──────────────────────┘  └──────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ Babysitter SDK CLI                          │    │
│  │ session:init | run:create | run:iterate     │    │
│  │ task:post | run:status                      │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 18
- [Codex CLI](https://github.com/openai/codex) installed (`npm i -g @openai/codex`)
- OpenAI API key configured for Codex

### Installation

```bash
git clone https://github.com/yaniv-tg/babysitter-codex.git
cd babysitter-codex
npm install
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
├── .codex/
│   ├── AGENTS.md                      # Project-scoped SDK CLI reference
│   ├── config.toml                    # MCP server + sandbox configuration
│   ├── orchestrate.js                 # Node.js orchestration wrapper
│   ├── effect-mapper.js               # Maps 6 effect kinds → Codex prompts
│   ├── result-poster.js               # Result posting with retry + blob handling
│   ├── iteration-guard.js             # 4-guard runaway detection module
│   └── hooks/
│       ├── utils.js                   # Shared utilities (getRunId, isValidRunId, etc.)
│       ├── session-init.js            # Session initialization hook
│       ├── on-turn-complete.js        # Turn completion logger + status check
│       ├── iteration-guard.js         # Hook entry point (delegates to standalone)
│       ├── loop-control.sh            # POSIX shell orchestration wrapper
│       ├── build-task-payload.js      # Safe JSON payload builder
│       ├── write-json.js              # Atomic JSON file writer
│       └── read-json.js              # Safe JSON field extractor
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

### Iteration Guards (`iteration-guard.js`)

Four independent guards running in parallel to prevent runaway execution:

| Guard | What it checks | Default |
|-------|---------------|---------|
| **Iteration** | Loop count vs max | 10 iterations |
| **Time** | Elapsed time vs timeout | 1 hour |
| **Cost** | Projected token usage vs budget | Configurable |
| **Stall** | Quality score plateau detection | 3 consecutive stalls |

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

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BABYSITTER_MAX_ITERATIONS` | Maximum loop iterations | `10` |
| `BABYSITTER_TIMEOUT` | Time limit in ms | `3600000` (1hr) |
| `BABYSITTER_MAX_COST` | Token budget threshold | unlimited |
| `BABYSITTER_RUN_ID` | Override run ID | auto-detected |
| `BABYSITTER_SESSION_ID` | Override session ID | auto-detected |
| `REPO_ROOT` | Project root directory | auto-detected |

### npm Scripts

```bash
npm run orchestrate    # Run the Node.js orchestrator
npm run loop-control   # Run the shell wrapper
npm test               # Validate all JS syntax + module resolution
npm run lint           # Syntax-check all integration files
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

## Security

- **Input sanitization**: All run IDs validated against ULID format (`/^[A-Za-z0-9-]+$/`) before shell interpolation
- **Safe JSON handling**: Dedicated `write-json.js` and `read-json.js` helpers replace fragile shell printf/grep/sed patterns
- **Atomic writes**: State files written via tmp-then-rename to prevent corruption
- **No path injection**: `build-task-payload.js` receives file paths as argv arguments, never interpolated into code strings
- **Sandbox isolation**: Codex configured with `disk-write-access-.a5c` to limit filesystem writes

## License

MIT
