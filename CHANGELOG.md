# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added
- SDK capability detection with explicit compatibility reporting (`full`, `compat-core`, `unsupported`).
- Deterministic per-run trace logging at `<runDir>/run-trace.jsonl`.
- Trace events across run lifecycle (run/iteration/task requested, executed, posted, failed, completed).
- Windows and Linux installation guides with platform-specific commands.

### Changed
- Orchestrator startup now fails fast when required core SDK commands are missing.
- Health diagnostics now include compatibility-aware missing core/advanced command reporting.
- README now clarifies Babysitter is external to Codex and explains real activation prompts per mode.
- Requirements documentation now clarifies SDK dependency is installed by `babysitter-codex` (non-circular install guidance).

## [2.1.0] - 2026-03-05

### Added
- Codex CLI skill package with one-step global install flow.
- 11 orchestration modes and hook-based integration.

### Notes
- Baseline for subsequent Codex compatibility and documentation improvements listed under `Unreleased`.
