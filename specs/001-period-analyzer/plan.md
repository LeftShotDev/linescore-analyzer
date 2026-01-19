# Implementation Plan: NHL Linescore Period Analyzer

**Branch**: `001-period-analyzer` | **Date**: 2026-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-period-analyzer/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a chat-based NHL analytics application that allows users to query period-by-period game performance using natural language. The system translates natural language into tool calls that execute database queries against NHL game data scraped from the official NHL Public API. Core hypothesis: teams winning 2+ regulation periods are more likely to succeed in playoffs.

Technical approach: Next.js application with Vercel AI SDK integrating Claude Sonnet 4.5 (primary LLM for chat) and GPT-4o (secondary for data processing). Three-tool architecture: query data, add games from API, calculate statistics. Supabase PostgreSQL database stores period-by-period results with empty net goals tracked separately.

## Technical Context

**Language/Version**: TypeScript (latest stable) with Next.js 14+
**Primary Dependencies**:
  - Next.js (App Router)
  - Vercel AI SDK
  - Anthropic SDK (@anthropic-ai/sdk)
  - OpenAI SDK (openai)
  - Supabase client (@supabase/supabase-js)
  - React 18+

**Storage**: Supabase (PostgreSQL) with three tables: teams, games, period_results
**Testing**: Vitest for unit tests, Playwright for integration tests (constitution requires testing SQL generation, period calculations, error handling, NHL API scraping validation)
**Target Platform**: Web browser (Vercel edge functions for API routes)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**:
  - Query responses within 5 seconds (per success criteria SC-004)
  - 100% accuracy on period outcome calculations (per success criteria SC-002)
  - 80% auto-recovery from failed queries (per success criteria SC-005)

**Constraints**:
  - NHL API rate limiting must be respected (per FR-016)
  - Session-based conversation only, no persistence (per FR-014)
  - SQL queries hidden from users (per FR-003)
  - Empty net goals excluded from 3rd period outcome calculations (per FR-008)

**Scale/Scope**:
  - Single-user MVP (no concurrency concerns initially)
  - 2024-2025 NHL season: ~1,312 games × 2 teams × 3-5 periods = ~8,000-13,000 period result records
  - 32 NHL teams
  - Future: multi-season support (per FR-011)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Data Accuracy & Integrity (NON-NEGOTIABLE)
✅ **PASS** - Plan includes:
- NHL Public API as exclusive data source (FR-005)
- Data validation before insertion (FR-015)
- Empty net goals tracked separately (FR-007)
- Complete metadata storage: date, teams, standings (FR-012)

### II. Tool-Driven Architecture (NON-NEGOTIABLE)
✅ **PASS** - Plan implements exactly three tools as specified:
- `query_linescore_data` - SELECT queries (FR-004)
- `add_games_from_api` - Fetch and insert from NHL API (FR-004)
- `calculate_period_stats` - Compute aggregates (FR-004)

Each tool will validate inputs, return structured responses, handle errors with LLM context, and use Supabase client exclusively.

### III. Natural Language Interface
✅ **PASS** - Plan includes:
- Natural language query acceptance (FR-001)
- LLM translation via Claude Sonnet 4.5 (FR-002)
- SQL hidden from users (FR-003)
- Session-based conversation (FR-014)
- Two-tier error handling: auto-retry once, then ask user to rephrase (FR-013)

### IV. Period Analysis Accuracy (NON-NEGOTIABLE)
✅ **PASS** - Plan ensures:
- Period tracking for 1st, 2nd, 3rd, OT, SO (FR-019)
- Empty net goals stored separately (FR-007)
- Empty net goals excluded from 3rd period outcome calculation (FR-008)
- Track 2+ regulation period wins per game (FR-009)
- Official NHL 3-letter team codes (FR-010)

### V. Extensibility & Future-Proofing
✅ **PASS** - Plan supports:
- Multi-season design with season identifier (FR-011)
- TypeScript for type safety (specified in Tech Stack)
- Separated concerns: data layer (Supabase), AI layer (Vercel AI SDK), presentation (Next.js components)
- Backward compatibility consideration in schema design

**Constitution Gates**: ✅ ALL PASSED - Proceeding to Phase 0 research

## Project Structure

### Documentation (this feature)

```text
specs/001-period-analyzer/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions and rationale
├── data-model.md        # Phase 1: Database schema and entities
├── quickstart.md        # Phase 1: Setup and usage instructions
├── contracts/           # Phase 1: Tool definitions and API contracts
│   ├── query-tool.md
│   ├── add-games-tool.md
│   └── calculate-stats-tool.md
└── tasks.md             # Phase 2: Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
app/
├── api/
│   └── chat/
│       └── route.ts          # Chat API endpoint with tool calling
├── page.tsx                  # Main chat interface
└── layout.tsx                # Root layout

lib/
├── supabase/
│   ├── client.ts             # Supabase client configuration
│   ├── queries.ts            # Database query functions
│   └── schema.sql            # Database schema definition
├── ai/
│   ├── claude-config.ts      # Anthropic Claude configuration
│   ├── openai-config.ts      # OpenAI GPT-4o configuration
│   └── providers.ts          # Vercel AI SDK provider setup
├── tools/
│   ├── query-linescore.ts    # query_linescore_data tool
│   ├── add-games.ts          # add_games_from_api tool
│   └── calculate-stats.ts    # calculate_period_stats tool
└── nhl-api/
    ├── client.ts             # NHL API client
    ├── types.ts              # NHL API response types
    └── transformers.ts       # Transform NHL data to DB schema

components/
├── chat/
│   ├── ChatInterface.tsx     # Main chat component
│   ├── MessageList.tsx       # Display messages
│   └── InputBox.tsx          # User input
└── ui/
    └── [shared UI components]

tests/
├── integration/
│   ├── chat-flow.test.ts     # End-to-end chat scenarios
│   └── nhl-api.test.ts       # NHL API integration tests
└── unit/
    ├── tools/                # Tool function tests
    ├── period-calc.test.ts   # Period outcome calculation tests
    └── sql-generation.test.ts # SQL generation edge cases

.env.local                     # Environment variables (not committed)
.env.example                   # Environment template
```

**Structure Decision**: Selected web application structure (Next.js App Router pattern). This aligns with the full-stack requirements where the chat interface (frontend) and tool execution (backend API routes) are tightly integrated. Next.js App Router enables server components for the chat UI and API routes for tool execution, eliminating the need for separate frontend/backend directories.

## Complexity Tracking

> No constitution violations - this section intentionally left empty.

The plan adheres to all five core principles without exceptions or justifications needed.
