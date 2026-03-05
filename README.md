# babysitter-codex

Babysitter SDK plugin for [OpenAI Codex CLI](https://github.com/openai/codex) — inline slash commands, structured orchestration, quality convergence loops, and full lifecycle hooks.

Use `/babysitter:yolo build me a REST API` inside Codex the same way you would in Claude Code.

## What is this?

This project makes [Babysitter](https://github.com/a5c-ai/babysitter) work natively inside OpenAI Codex CLI through a plugin system that mirrors the Claude Code babysitter plugin:

- **11 slash commands** — `/babysitter:call`, `/babysitter:yolo`, `/babysitter:doctor`, etc.
- **Plugin manifest** — `plugin.json` registers commands, hooks, and skills
- **Skill loader** — resolves commands with alias support and typo suggestions
- **Hook-driven orchestration** — SessionStart initializes, Stop hook drives the iteration loop
- **Full harness** — effect mapper, iteration guards, profile manager, discovery, health checks

Together, [Codex CLI](https://github.com/openai/codex) executes individual tasks while [Babysitter SDK](https://www.npmjs.com/package/@a5c-ai/babysitter-sdk) manages the overall process — tracking progress, enforcing quality gates, posting results, and converging on targets.

## Installation

### Prerequisites

- **Node.js** >= 18
- **[OpenAI Codex CLI](https://github.com/openai/codex)** >= 0.107
- **OpenAI API key** — `export OPENAI_API_KEY=sk-...`

### Option 1: Clone and Run (Standalone Project)

```bash
# Clone the repo
git clone https://github.com/yaniv-tg/babysitter-codex.git
cd babysitter-codex

# Install dependencies (includes babysitter SDK automatically)
npm install

# Verify everything works
npm test

# Install the SDK CLI globally (recommended)
npm install -g @a5c-ai/babysitter-sdk

# Run health check
babysitter health --verbose
```

### Option 2: Add to an Existing Codex Project

```bash
# From inside your existing project directory:

# 1. Clone babysitter-codex somewhere temporary
git clone https://github.com/yaniv-tg/babysitter-codex.git /tmp/babysitter-codex

# 2. Copy the plugin files into your project
cp -r /tmp/babysitter-codex/.codex .codex
cp /tmp/babysitter-codex/AGENTS.md AGENTS.md

# 3. Install the SDK
npm install @a5c-ai/babysitter-sdk

# 4. Install the SDK CLI globally (recommended)
npm install -g @a5c-ai/babysitter-sdk

# 5. Verify
babysitter health --verbose
npm test --prefix /tmp/babysitter-codex

# 6. Clean up
rm -rf /tmp/babysitter-codex
```

### Option 3: Manual Setup (Minimal)

If you only want the slash command system without the full harness:

```bash
# Install the SDK
npm install @a5c-ai/babysitter-sdk
npm install -g @a5c-ai/babysitter-sdk

# Create the directory structure
mkdir -p .codex/skills/babysitter .codex/hooks

# Copy the essential files from the repo:
#   .codex/plugin.json          — plugin manifest
#   .codex/skill-loader.js      — command resolver
#   .codex/command-dispatcher.js — slash command parser
#   .codex/config.toml           — MCP server + hooks config
#   .codex/skills/babysitter/*/SKILL.md — all 11 skill files
#   .codex/hooks/babysitter-session-start.sh — SessionStart hook
#   .codex/hooks/babysitter-stop-hook.sh     — Stop hook
#   AGENTS.md                    — agent instructions with slash command dispatch

# Make hooks executable
chmod +x .codex/hooks/babysitter-*.sh
```

### Verify Installation

```bash
# All of these should work after installation:
babysitter health --verbose --json   # SDK health check
node -e "require('./.codex/skill-loader')"  # Skill loader loads
node -e "require('./.codex/command-dispatcher')"  # Dispatcher loads
```

## Usage

Start Codex CLI and type any babysitter slash command:

```bash
codex

# Then inside the Codex session:
> /babysitter:yolo build a REST API with authentication
> /babysitter:doctor
> /babysitter:observe
```

Or run headless:

```bash
# Shell wrapper (CI/production)
.codex/hooks/loop-control.sh "my-process" "./process.js#process" "Build a todo app" 10

# Node.js orchestrator (interactive)
node .codex/orchestrate.js --process-id "my-process" --entry "./process.js#process" --prompt "Build a todo app"

# MCP server (in-session, Codex calls SDK tools directly)
codex --full-auto "Follow the babysitter orchestration protocol in AGENTS.md"
```

## Slash Commands

All babysitter operations are available as inline `/babysitter:*` slash commands inside Codex CLI.

| Command | Description |
|---------|-------------|
| `/babysitter:call` | Start an orchestration run (interactive, with breakpoints) |
| `/babysitter:yolo` | Start a run in autonomous mode (no breakpoints) |
| `/babysitter:resume` | Resume an existing paused or interrupted run |
| `/babysitter:plan` | Plan a workflow without executing it |
| `/babysitter:forever` | Start a never-ending periodic run |
| `/babysitter:doctor` | Diagnose run health (10 checks: journal, state, effects, locks, sessions, logs) |
| `/babysitter:observe` | Launch the real-time observer dashboard in your browser |
| `/babysitter:help` | Help and documentation for any command, process, or skill |
| `/babysitter:project-install` | Onboard a project (analyze codebase, build project profile, configure tools) |
| `/babysitter:user-install` | Set up your user profile (specialties, preferences, breakpoint tolerance) |
| `/babysitter:assimilate` | Import an external methodology, harness, or specification into babysitter processes |

**Aliases:** `/babysitter` and `/babysitter:babysit` both map to `/babysitter:call`.

### How Slash Commands Work

1. **AGENTS.md** instructs Codex to recognize `/babysitter:*` input as slash commands
2. **skill-loader.js** resolves the command name (with alias support and Levenshtein typo suggestions)
3. **command-dispatcher.js** parses the input, loads the matching `SKILL.md`, and returns instructions
4. Each **SKILL.md** contains self-contained instructions that Codex follows to execute the command
5. **Hook scripts** drive the orchestration loop — SessionStart initializes, Stop iterates

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       Orchestration Layer                        │
│                                                                  │
│  Slash Commands (/babysitter:*)                                  │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Command   │  │ Skill        │  │ SKILL.md     │              │
│  │ Dispatcher│→ │ Loader       │→ │ Instructions │              │
│  └───────────┘  └──────────────┘  └──────┬───────┘              │
│                                          │                      │
│  loop-control.sh / orchestrate.js        │                      │
│  ┌───────────┐  ┌──────────────┐  ┌──────▼───────┐              │
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
│  │ 13 lifecycle hooks   │  │ user/project scopes  │             │
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
│  │ run:create | run:iterate | task:post | run:status        │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
.
├── AGENTS.md                          # Agent instructions (slash command dispatch + orchestration)
├── package.json                       # Project config + npm scripts
├── test/
│   ├── integration.test.js            # Syntax validation + module resolution tests
│   └── harness.test.js                # Unit tests for all harness components
├── .codex/
│   ├── AGENTS.md                      # Project-scoped SDK CLI reference
│   ├── config.toml                    # MCP server + sandbox + plugin + hooks config
│   ├── plugin.json                    # Plugin manifest (11 commands, hooks)
│   ├── skill-loader.js                # Command resolver (aliases, Levenshtein suggestions)
│   ├── command-dispatcher.js          # Slash command parser and dispatcher
│   ├── orchestrate.js                 # Node.js orchestration wrapper
│   ├── effect-mapper.js               # Maps 9 effect kinds to Codex prompts
│   ├── result-poster.js               # Result posting with retry + blob handling
│   ├── iteration-guard.js             # 4-guard runaway detection module
│   ├── hook-dispatcher.js             # Routes events to 13 hook types
│   ├── profile-manager.js             # User/project profile CRUD + render
│   ├── discovery.js                   # skill:discover + @skill/@agent marker parser
│   ├── session-manager.js             # Full session lifecycle (8 commands)
│   ├── health-check.js                # SDK health + configure diagnostics
│   ├── skills/babysitter/             # Slash command skill files
│   │   ├── call/SKILL.md             # /babysitter:call
│   │   ├── yolo/SKILL.md             # /babysitter:yolo
│   │   ├── resume/SKILL.md           # /babysitter:resume
│   │   ├── plan/SKILL.md             # /babysitter:plan
│   │   ├── forever/SKILL.md          # /babysitter:forever
│   │   ├── doctor/SKILL.md           # /babysitter:doctor
│   │   ├── observe/SKILL.md          # /babysitter:observe
│   │   ├── help/SKILL.md             # /babysitter:help
│   │   ├── project-install/SKILL.md  # /babysitter:project-install
│   │   ├── user-install/SKILL.md     # /babysitter:user-install
│   │   └── assimilate/SKILL.md       # /babysitter:assimilate
│   └── hooks/
│       ├── babysitter-session-start.sh # SessionStart hook
│       ├── babysitter-stop-hook.sh    # Stop hook (drives orchestration loop)
│       ├── loop-control.sh            # POSIX shell orchestration wrapper
│       ├── utils.js                   # Shared utilities
│       ├── session-init.js            # Session initialization
│       ├── on-turn-complete.js        # Turn completion logger
│       ├── iteration-guard.js         # Hook entry point
│       ├── build-task-payload.js      # Safe JSON payload builder
│       ├── write-json.js              # Atomic JSON file writer
│       ├── read-json.js               # Safe JSON field extractor
│       └── <hook-type>/              # 13 lifecycle hook handlers
└── .a5c/
    └── runs/                          # Babysitter run state (gitignored)
```

## Components

### Plugin System (v2.0)

| File | Purpose |
|------|---------|
| `plugin.json` | Manifest registering 11 commands with names, file paths, descriptions, aliases |
| `skill-loader.js` | Resolves `/babysitter:*` commands to SKILL.md paths; supports aliases and Levenshtein-based typo suggestions |
| `command-dispatcher.js` | Parses user input, detects slash commands, loads instructions, generates help summaries |
| `babysitter-session-start.sh` | SessionStart hook — initializes babysitter session on Codex startup |
| `babysitter-stop-hook.sh` | Stop hook — drives the orchestration iteration loop |

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

| Guard | What it checks | Default |
|-------|---------------|---------|
| **Iteration** | Loop count vs max | 10 iterations |
| **Time** | Elapsed time vs timeout | 1 hour |
| **Cost** | Projected token usage vs budget | Configurable |
| **Stall** | Quality score plateau detection | 3 consecutive stalls |

### Hook System (`hook-dispatcher.js`)

13 lifecycle hooks — drop `.js` handlers into `.codex/hooks/<hookType>/` and they auto-run:

| Hook Type | When it fires |
|-----------|--------------|
| `on-run-start` | New run begins |
| `on-run-complete` | Run finishes successfully |
| `on-run-fail` | Run terminates with error |
| `on-task-start` | Task begins |
| `on-task-complete` | Task finishes |
| `on-step-dispatch` | Step dispatched within a task |
| `on-iteration-start` | Iteration loop begins |
| `on-iteration-end` | Iteration loop ends |
| `on-breakpoint` | Breakpoint reached |
| `pre-commit` | Before git commit |
| `pre-branch` | Before git branch creation |
| `post-planning` | After planning phase |
| `on-score` | Quality score recorded |

### Profile System (`profile-manager.js`)

All operations use the babysitter CLI — `babysitter profile:<subcommand> --user|--project`:

| Function | CLI Command |
|----------|------------|
| `readUserProfile()` | `profile:read --user --json` |
| `writeUserProfile(data)` | `profile:write --user --input <file> --json` |
| `mergeUserProfile(data)` | `profile:merge --user --input <file> --json` |
| `renderUserProfile()` | `profile:render --user` |
| Same pattern for project profiles | `--project` instead of `--user` |

### Other Components

| Component | Description |
|-----------|-------------|
| `discovery.js` | `skill:discover` CLI wrapper + `@skill`/`@agent` JSDoc marker parser |
| `session-manager.js` | Full session lifecycle (8 commands: init, associate, resume, state, update, check-iteration, iteration-message, last-message) |
| `health-check.js` | SDK health checks + configuration diagnostics |
| `result-poster.js` | Posts results via `task:post` with retry (3 attempts, exponential backoff) and large file blob offloading |

## Writing Process Definitions

```javascript
import { defineTask } from '@a5c-ai/babysitter-sdk';

export async function process(inputs, ctx) {
  // Phase 1: Analysis
  const analysis = await ctx.task(analyzeTask, { scope: inputs.scope });

  // Breakpoint: human review
  await ctx.breakpoint({ question: 'Proceed with implementation?' });

  // Phase 2: Parallel implementation
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

### npm Scripts

```bash
npm test                   # Run all tests (integration + harness)
npm run orchestrate        # Run the Node.js orchestrator
npm run loop-control       # Run the shell wrapper
npm run lint               # Syntax-check all .codex JS files
npm run observe            # Launch observer dashboard
npm run health             # SDK health check
npm run discover           # Discover available skills
npm run profile:user       # Render user profile
npm run profile:project    # Render project profile
```

### MCP Server

Codex can call babysitter tools directly via the configured MCP server in `config.toml`:

```toml
[mcp_servers.babysitter]
command = "npx"
args = ["-y", "@a5c-ai/babysitter-sdk@0.0.173", "mcp-server"]

[mcp_servers.babysitter.env]
BABYSITTER_RUNS_DIR = ".a5c/runs"
```

### Testing

```bash
npm test                          # All tests
node test/integration.test.js     # Syntax validation + module resolution
node test/harness.test.js         # Unit tests for all harness components
```

## Changelog

### v2.0.0 — Plugin System + Slash Commands

Full plugin system that makes babysitter work as inline slash commands inside Codex CLI, mirroring the Claude Code babysitter plugin experience.

**Added:**
- `plugin.json` — plugin manifest registering 11 commands with aliases, descriptions, and argument hints
- `skill-loader.js` — command resolver with alias mapping, Levenshtein typo suggestions, and plugin.json parsing
- `command-dispatcher.js` — slash command parser, dispatcher, and help generator
- `babysitter-session-start.sh` — SessionStart hook that initializes the babysitter session
- `babysitter-stop-hook.sh` — Stop hook that drives the orchestration iteration loop
- 11 `SKILL.md` files — self-contained instructions for every babysitter command:
  - `/babysitter:call` — interactive orchestration with breakpoints
  - `/babysitter:yolo` — autonomous non-interactive mode
  - `/babysitter:resume` — resume paused/interrupted runs
  - `/babysitter:plan` — plan without executing
  - `/babysitter:forever` — never-ending periodic runs
  - `/babysitter:doctor` — 10-check health diagnostics
  - `/babysitter:observe` — real-time observer dashboard
  - `/babysitter:help` — documentation and help
  - `/babysitter:project-install` — project onboarding
  - `/babysitter:user-install` — user profile setup
  - `/babysitter:assimilate` — methodology/harness/spec import

**Updated:**
- `AGENTS.md` — added Section 0 (Slash Command Recognition) teaching Codex to parse and dispatch `/babysitter:*` commands
- `config.toml` — added `[plugin]` manifest reference and `[hooks]` section for SessionStart/Stop
- `README.md` — full rewrite with installation instructions, slash command docs, and changelog

### v1.1.0 — SDK v0.0.173+ Upgrade

Upgraded harness to support all Babysitter SDK v0.0.173+ features (28 gaps fixed).

**Added:**
- `profile-manager.js` — user/project profile CRUD via CLI (`--user`/`--project` flags)
- `discovery.js` — `skill:discover` CLI wrapper + `@skill`/`@agent` JSDoc marker parser
- `session-manager.js` — full session lifecycle (8 CLI commands)
- `health-check.js` — SDK health + configure diagnostics with startup gate
- Hook handler scripts for all 13 lifecycle hook types
- `build-task-payload.js`, `write-json.js`, `read-json.js` — safe JSON handling utilities
- `test/harness.test.js` — comprehensive unit tests for all harness components

**Updated:**
- `effect-mapper.js` — added `orchestrator_task` effect kind (9 total)
- `iteration-guard.js` — added cost guard and stall detection
- `hook-dispatcher.js` — routes to all 13 hook types with handler auto-discovery
- `result-poster.js` — added retry with exponential backoff and blob offloading
- `loop-control.sh` — added iteration guards, hook firing, and session management
- `config.toml` — fixed profile CLI flags (`--user`/`--project`, `--input`)

### v1.0.0 — Initial Release

Initial harness connecting Babysitter SDK orchestration to OpenAI Codex CLI.

**Included:**
- `effect-mapper.js` — maps 8 effect kinds to Codex prompts
- `result-poster.js` — posts results via `task:post`
- `iteration-guard.js` — iteration count and time guards
- `hook-dispatcher.js` — basic hook routing
- `orchestrate.js` — Node.js orchestration wrapper
- `loop-control.sh` — POSIX shell orchestration wrapper
- `config.toml` — MCP server + sandbox configuration
- `AGENTS.md` — agent instructions for Codex
- `test/integration.test.js` — syntax validation tests

## Q&A

**Q: How is this different from babysitter on Claude Code?**
It's the same experience. You type `/babysitter:yolo fix all the bugs` in Codex CLI and it works exactly like it does in Claude Code — same commands, same orchestration loop, same process definitions.

**Q: Can I use this without the Babysitter SDK?**
No. The SDK is the orchestration engine. This harness is the bridge that lets Codex CLI act as the task executor.

**Q: What happens if Codex crashes mid-run?**
All task results already posted to the journal are preserved. Use `/babysitter:resume` to pick up where you left off, or `/babysitter:doctor` to diagnose the run state.

**Q: How do I monitor a running orchestration?**
`/babysitter:observe` or `npm run observe`. Opens a real-time dashboard in your browser.

**Q: What are breakpoints?**
Human approval gates. When reached, orchestration pauses until you approve. Use `/babysitter:yolo` to skip them, or configure `breakpointTolerance` in your user profile.

**Q: How do I customize iteration limits?**
Set `BABYSITTER_MAX_ITERATIONS=20`, `BABYSITTER_TIMEOUT=7200000`, or `BABYSITTER_MAX_COST=50000`.

**Q: Can I add custom hooks?**
Yes. Drop a `.js` file into `.codex/hooks/<hookType>/` (e.g., `.codex/hooks/on-task-complete/slack-notify.js`). The hook dispatcher auto-discovers and runs all handlers.

**Q: What SDK version does this target?**
`@a5c-ai/babysitter-sdk@0.0.173+` with support up to v0.0.175.

**Q: How do I import an external methodology?**
`/babysitter:assimilate https://github.com/org/methodology-repo` — converts it into babysitter process definitions with skills and agents.

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
- Slash commands resolving to the wrong skill (Beni shuffled the plugin.json)

If you encounter any issue not listed above, it is also Beni's fault. File an issue and tag it `blame-beni`.

> "I didn't do it." — Beni (lying)

## Security

- **Input sanitization**: All run IDs validated against ULID format before shell interpolation
- **Safe JSON handling**: Dedicated `write-json.js` and `read-json.js` helpers replace fragile shell patterns
- **Atomic writes**: State files written via tmp-then-rename to prevent corruption
- **No path injection**: File paths passed as argv arguments, never interpolated into code strings
- **Sandbox isolation**: Codex configured with `disk-write-access-.a5c` to limit filesystem writes

## License

MIT
